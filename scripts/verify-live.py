"""Read-only live smoke check; --check-reminders also runs the protected reminder job."""
import argparse
import json
import subprocess
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--check-reminders', action='store_true')
args = parser.parse_args()
base = 'https://reunite-now-9a04.azurewebsites.net'

def request(path, secret=None):
    req = urllib.request.Request(base + path)
    if secret:
        req.method = 'POST'
        req.add_header('Authorization', 'Bearer ' + secret)
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)

health = request('/api/health')
assert health['ok'] is True
config = request('/api/config')
assert config['devAuth'] is False
public = request('/api/public')
# Print only aggregate/configuration information, never submitted records.
print(json.dumps({'health': health, 'authentication': config, 'publicEndpoint': 'reachable'}))
if args.check_reminders:
    result = subprocess.run([
        'az', 'webapp', 'config', 'appsettings', 'list',
        '-g', 'reunite-now-rg', '-n', 'reunite-now-9a04',
        '--subscription', '9a04b64b-af19-4519-be50-56ec2acbd855', '-o', 'json'
    ], check=True, capture_output=True, text=True)
    settings = {item['name']: item['value'] for item in json.loads(result.stdout)}
    print(json.dumps({'reminderCheck': request('/api/jobs/reminders', settings['CRON_SECRET'])}))
