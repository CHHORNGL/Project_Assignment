"""Run with: .venv/bin/python -m unittest discover -s tests -v"""
import unittest
from flask import Flask
from werkzeug.security import generate_password_hash
from app.extensions import db
from app.models.user import User, PASSWORD_HASH_METHOD


class PasswordHashingTests(unittest.TestCase):
    def test_random_salts_and_unicode_round_trip(self):
        password = 'សួស្តី🌾 correct horse battery staple'
        first, second = User(), User()
        first.set_password(password)
        second.set_password(password)
        self.assertNotEqual(first.password_hash, second.password_hash)
        self.assertTrue(first.password_hash.startswith(PASSWORD_HASH_METHOD + '$'))
        self.assertLessEqual(len(first.password_hash), 255)
        self.assertTrue(first.check_password(password))
        self.assertFalse(first.check_password(password + '!'))
        original = first.password_hash
        self.assertTrue(first.check_password(password, upgrade=True))
        self.assertEqual(original, first.password_hash)

    def test_legacy_hashes_upgrade_only_with_correct_password(self):
        for method in ('pbkdf2:sha256:600000', 'scrypt:32768:8:1'):
            with self.subTest(method=method):
                original = generate_password_hash('old password', method=method)
                user = User(password_hash=original)
                self.assertFalse(user.check_password('wrong', upgrade=True))
                self.assertEqual(original, user.password_hash)
                self.assertTrue(user.check_password('old password'))
                self.assertEqual(original, user.password_hash)
                self.assertTrue(user.check_password('old password', upgrade=True))
                self.assertTrue(user.password_hash.startswith(PASSWORD_HASH_METHOD + '$'))
                self.assertTrue(user.check_password('old password'))

    def test_bad_inputs_fail_closed(self):
        for stored in (None, '', 'plain$$secret', 'sha256$salt$hash',
                       'pbkdf2:sha256:bad$salt$hash', 'scrypt:bad$salt$hash'):
            self.assertFalse(User(password_hash=stored).check_password('secret', upgrade=True))
        user = User()
        for password in (None, '', 123, [], {}):
            self.assertFalse(user.check_password(password))
            with self.assertRaises(ValueError):
                user.set_password(password)

    def test_stronger_scrypt_parameters_are_not_downgraded(self):
        self.assertFalse(User._password_hash_needs_upgrade('scrypt:262144:8:1'))
        self.assertFalse(User._password_hash_needs_upgrade('scrypt:131072:8:2'))

    def test_upgrade_survives_database_reload(self):
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'
        db.init_app(app)
        with app.app_context():
            db.create_all()
            user = User(username='hash-test', password_hash=generate_password_hash(
                'existing password', method='pbkdf2:sha256:600000'))
            db.session.add(user)
            db.session.commit()
            user_id = user.id
            self.assertTrue(user.check_password('existing password', upgrade=True))
            db.session.commit()
            db.session.remove()
            saved = db.session.get(User, user_id)
            self.assertTrue(saved.password_hash.startswith(PASSWORD_HASH_METHOD + '$'))
            self.assertTrue(saved.check_password('existing password'))
            db.session.remove()
            db.drop_all()


if __name__ == '__main__':
    unittest.main()
