import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from subprocess import CompletedProcess
from scripts import audit_dependencies as audit


class AuditEnforcementTests(unittest.TestCase):
    def test_parity_checks_versions_and_normalizes_extras(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'requirements.txt'
            lock = Path(directory) / 'requirements.lock'
            manifest.write_text('Flask-Limiter[redis]==4.1.1\n')
            lock.write_text('flask_limiter==4.1.0\n')
            self.assertFalse(audit.check_manifest_lockfile_sync(manifest, lock)[0])
            lock.write_text('flask_limiter==4.1.1\n')
            self.assertTrue(audit.check_manifest_lockfile_sync(manifest, lock)[0])

    def test_missing_scanner_is_failure(self):
        with patch.object(audit.subprocess, 'run', return_value=CompletedProcess([], 1, '', 'missing')):
            self.assertFalse(audit.run_pip_audit()[0])

    def test_strict_python_ci_fails_on_advisory_without_running_npm(self):
        with patch('sys.argv', ['audit', '--strict', '--python-only']), \
             patch.object(audit, 'check_manifest_lockfile_sync', return_value=(True, 'ok')), \
             patch.object(audit, 'check_pip_tree', return_value=(True, 'ok')), \
             patch.object(audit, 'run_pip_audit', return_value=(False, 'advisory')), \
             patch.object(audit, 'check_frontend') as frontend:
            with self.assertRaises(SystemExit) as result:
                audit.main()
            self.assertEqual(result.exception.code, 1)
            frontend.assert_not_called()
