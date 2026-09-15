import unittest
from unittest.mock import Mock
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
from setup_db import initialize_database


class DatabaseBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'
        self.db = SQLAlchemy(self.app)
        self.db.Table('items', self.db.Column('id', self.db.Integer, primary_key=True))
        self.context = self.app.app_context()
        self.context.push()
        self.addCleanup(self.context.pop)
        self.stamp = Mock()

    def test_empty_database_creates_current_schema_and_stamps_once(self):
        initialize_database(self.db, self.stamp)
        self.assertIn('items', inspect(self.db.engine).get_table_names())
        self.stamp.assert_called_once_with(revision='head')

    def test_existing_database_preserves_revision_and_data_for_upgrade(self):
        with self.db.engine.begin() as conn:
            conn.execute(text('CREATE TABLE alembic_version (version_num VARCHAR(32))'))
            conn.execute(text("INSERT INTO alembic_version VALUES ('older_revision')"))
            conn.execute(text('CREATE TABLE legacy_items (id INTEGER PRIMARY KEY)'))
            conn.execute(text('INSERT INTO legacy_items VALUES (7)'))
        initialize_database(self.db, self.stamp)
        self.stamp.assert_not_called()
        self.assertNotIn('items', inspect(self.db.engine).get_table_names())
        with self.db.engine.connect() as conn:
            self.assertEqual(conn.execute(text('SELECT version_num FROM alembic_version')).scalar(), 'older_revision')
            self.assertEqual(conn.execute(text('SELECT id FROM legacy_items')).scalar(), 7)

    def test_unversioned_existing_database_is_not_silently_stamped(self):
        self.db.create_all()
        with self.assertRaisesRegex(RuntimeError, 'no migration history'):
            initialize_database(self.db, self.stamp)
        self.stamp.assert_not_called()
