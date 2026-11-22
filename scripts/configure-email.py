"""Activate the project's verified Europe-geography sender on the Swedish web app."""
import json
import subprocess
import tempfile

SUB = '9a04b64b-af19-4519-be50-56ec2acbd855'
GROUP = 'reunite-now-eu-rg'
DOMAIN = 'visatransparencypetition.org'
BASE = f'https://management.azure.com/subscriptions/{SUB}/resourceGroups/{GROUP}/providers/Microsoft.Communication'
VERSION = '?api-version=2023-04-01'

def az(*args):
    result = subprocess.run(['az', *args, '--subscription', SUB, '--only-show-errors', '-o', 'json'],
                            check=True, capture_output=True, text=True)
    return json.loads(result.stdout) if result.stdout.strip() else None

domain_url = BASE + '/emailServices/reunite-now-eu-email/domains/' + DOMAIN
service_url = BASE + '/communicationServices/reunite-now-eu-communication'
domain = az('rest', '-m', 'get', '-u', domain_url + VERSION)
service = az('rest', '-m', 'get', '-u', service_url + VERSION)['properties']
states = domain['properties']['verificationStates']
if any(states[k]['status'] != 'Verified' for k in ['Domain', 'SPF', 'DKIM', 'DKIM2']):
    raise SystemExit('European custom domain verification is incomplete.')
if service['dataLocation'] != 'Europe' or domain['id'].lower() not in [v.lower() for v in service['linkedDomains']]:
    raise SystemExit('Link the verified domain to the Europe Communication Service first.')
sender = az('rest', '-m', 'get', '-u', domain_url + '/senderUsernames/ethan' + VERSION)
if sender['properties']['username'] != 'ethan':
    raise SystemExit('The project sender is unavailable.')
keys = az('rest', '-m', 'post', '-u', service_url + '/listKeys' + VERSION)
with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as settings:
    json.dump({'AZURE_COMMUNICATION_CONNECTION_STRING':keys['primaryConnectionString'],
               'EMAIL_FROM':'ethan@' + DOMAIN}, settings)
    settings.flush()
    for prefix in ['reunite-now','reunite-now-eu']:
        az('webapp', 'config', 'appsettings', 'set', '-g', prefix+'-rg', '-n', prefix+'-9a04',
           '--settings', '@' + settings.name)
print('European outbound email configured. No messages sent.')
