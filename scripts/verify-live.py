"""Read-only live smoke check; --check-reminders also runs the protected reminder job."""
import argparse
import json
import subprocess
import urllib.request
import urllib.error
import urllib.parse

parser = argparse.ArgumentParser()
parser.add_argument('--check-reminders', action='store_true')
parser.add_argument('--base-url', default='https://visatransparency.org')
args = parser.parse_args()
base = args.base_url.rstrip('/')
if urllib.parse.urlparse(base).scheme != 'https':
    raise SystemExit('Use a trusted HTTPS URL for production checks.')

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
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def redirect(path):
    try:
        urllib.request.build_opener(NoRedirect).open(base + path, timeout=30)
    except urllib.error.HTTPError as response:
        if response.code in (302, 303, 307, 308):
            return urllib.parse.urlparse(response.headers.get('Location', ''))
        raise
    raise AssertionError('Expected a redirect')

if config.get('googleAuth'):
    target = redirect('/api/auth/google')
    assert target.hostname == 'accounts.google.com', 'Google sign-in must redirect to Google'
    assert urllib.parse.parse_qs(target.query).get('redirect_uri') == [base + '/api/auth/google/callback'], 'Google callback must use the canonical hostname'

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
