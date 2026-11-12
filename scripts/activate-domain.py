"""Activate the verified website/sender and update Azure reminders; sends no email."""
import json
import os
import pathlib
import subprocess
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SUB = '9a04b64b-af19-4519-be50-56ec2acbd855'
RG = 'reunite-now-rg'
APP = 'reunite-now-9a04'
ORIGIN = 'https://visatransparency.org'
ARM = f'https://management.azure.com/subscriptions/{SUB}/resourceGroups/{RG}/providers/Microsoft.Communication'

def az(*args):
    result = subprocess.run(['az', *args, '--subscription', SUB, '--only-show-errors', '-o', 'json'], capture_output=True, text=True)
    if result.returncode:
        raise SystemExit('Azure operation failed; provider output withheld to protect settings.')
    return json.loads(result.stdout) if result.stdout.strip() else None

# Azure certificate bindings can briefly reach frontends at different times.
# Require repeated successful HTTPS/database checks before changing the URL.
consecutive = 0
for attempt in range(8):
    try:
        for hostname in ['visatransparency.org', 'www.visatransparency.org']:
            with urllib.request.urlopen(f'https://{hostname}/api/health', timeout=10) as response:
                if json.load(response).get('ok') is not True:
                    raise ValueError('Database health check failed')
        consecutive += 1
        if consecutive == 3:
            break
    except Exception:
        consecutive = 0
    if attempt < 7:
        time.sleep(3)
else:
    raise SystemExit('Trusted HTTPS is still propagating; no settings changed. Retry after both certificates settle.')

domain = az('rest', '--method', 'get', '--url', ARM + '/emailServices/reunite-now-email/domains/visatransparency.org?api-version=2023-04-01')
if not all(domain['properties']['verificationStates'][kind]['status'] == 'Verified' for kind in ['Domain', 'SPF', 'DKIM', 'DKIM2']):
    raise SystemExit('The custom sender domain is not fully verified.')
communication = az('rest', '--method', 'get', '--url', ARM + '/communicationServices/reunite-now-communication?api-version=2023-04-01')
if domain['id'].lower() not in [item.lower() for item in communication['properties'].get('linkedDomains', [])]:
    raise SystemExit('The custom sender is not linked to the Communication Service.')
sender = az('rest', '--method', 'get', '--url', ARM + '/emailServices/reunite-now-email/domains/visatransparency.org/senderUsernames/noreply?api-version=2023-04-01')
if sender['properties']['username'] != 'noreply':
    raise SystemExit('The custom sender is missing.')
settings = {item['name']: item['value'] for item in az('webapp', 'config', 'appsettings', 'list', '-g', RG, '-n', APP)}
if not settings.get('GOOGLE_CLIENT_ID') or not settings.get('GOOGLE_CLIENT_SECRET'):
    raise SystemExit('Google credentials must be configured before cutover.')
if not settings.get('AZURE_COMMUNICATION_CONNECTION_STRING') and not settings.get('AZURE_COMMUNICATION_ENDPOINT'):
    raise SystemExit('Azure email credentials must be configured before cutover.')

settings_path = None
try:
    with tempfile.NamedTemporaryFile(mode='w', prefix='reunite-domain-settings-', suffix='.json', delete=False) as handle:
        settings_path = handle.name
        os.chmod(settings_path, 0o600)
        json.dump({'APP_URL': ORIGIN, 'EMAIL_FROM': 'noreply@visatransparency.org'}, handle)
    az('webapp', 'config', 'appsettings', 'set', '-g', RG, '-n', APP, '--settings', '@' + settings_path)
finally:
    if settings_path:
        os.unlink(settings_path)
subprocess.run(['python3', str(ROOT / 'scripts/configure-reminders.py')], cwd=ROOT, check=True)
az('webapp', 'restart', '-g', RG, '-n', APP)
print(json.dumps({'appUrl': ORIGIN, 'emailFrom': 'noreply@visatransparency.org', 'messagesSent': 0, 'next': 'Wait for restart, then verify health, Google redirect, and email delivery.'}))
