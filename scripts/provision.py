"""Configure the two regional App Services and databases from operator-supplied secrets."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SUB = '9a04b64b-af19-4519-be50-56ec2acbd855'
REGIONS = [
    ('us', 'northcentralus', 'reunite-now', 'reunite-now-pg-9a04', 'petition_us'),
    ('eu', 'swedencentral', 'reunite-now-eu', 'reunite-now-se-pg-9a04', 'reunite_now'),
]

def az(*args):
    result = subprocess.run(['az', *args, '--only-show-errors', '--subscription', SUB, '-o', 'json'], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Azure operation failed: ' + ' '.join(args[:3]))
    return json.loads(result.stdout) if result.stdout.strip() else None

def file_arg(values, callback):
    with tempfile.NamedTemporaryFile(mode='w') as f:
        json.dump(values, f)
        f.flush()
        return callback('@' + f.name)

def deploy(group, template, values):
    params = {key: {'value': value} for key, value in values.items()}
    file_arg(params, lambda f: az('deployment','group','create','-g',group,'--template-file',str(ROOT/'infra'/template),'--parameters',f,'--query','properties.provisioningState'))

urls = {r: os.environ['DATABASE_URL_' + r.upper()] for r, *_ in REGIONS}
readers = {r: os.environ.get('DATABASE_READER_URL_' + r.upper()) for r, *_ in REGIONS}
restricted = any(readers.values())
if restricted and not all(readers.values()):
    raise SystemExit('Configure a reader in both regions')
admins = {r: os.environ['DATABASE_ADMIN_URL_' + r.upper()] for r, *_ in REGIONS} if restricted else urls
secret = os.environ['CRON_SECRET']
for r, _, _, server, name in REGIONS:
    admin = urlsplit(admins[r])
    expected = (server + '.postgres.database.azure.com', '/' + name)
    if (admin.hostname, admin.path) != expected or admin.username != 'reunite_admin' or not admin.password:
        raise SystemExit('Expected the configured regional administrator for ' + r)
    if restricted:
        writer, reader = urlsplit(urls[r]), urlsplit(readers[r])
        for account in (writer, reader):
            if (account.hostname, account.path) != expected or not account.username or not account.password:
                raise SystemExit('Expected a regional application login for ' + r)
        if len({admin.username, writer.username, reader.username}) != 3:
            raise SystemExit('Use distinct release, runtime and reader logins for ' + r)
if not restricted:
    # A legacy invocation must never replace restricted runtime credentials.
    for _, _, prefix, _, _ in REGIONS:
        group = prefix + '-rg'
        if az('group', 'exists', '-n', group) and az('webapp','list','-g',group,'--query',
                f"[?name=='{prefix}-9a04'].name"):
            if az('webapp','config','appsettings','list','-g',group,'-n',prefix+'-9a04',
                  '--query', "[?starts_with(name,'DATABASE_READER_URL_')].name"):
                raise SystemExit('This deployment already uses separate reader credentials')
ips = set()
for r, location, prefix, server, name in REGIONS:
    group = prefix + '-rg'
    deploy(group, 'main.bicep', dict(location=location,prefix=prefix,databaseServerName=server,databaseName=name,
        databasePassword=unquote(urlsplit(admins[r]).password),geoBackup=(r=='eu'),storageAutoGrow=(r=='eu'),
        communicationDataLocation='Europe' if r=='eu' else 'United States'))
    ips.update(az('webapp','show','-g',group,'-n',prefix+'-9a04','--query','possibleOutboundIpAddresses').split(','))
for r, _, prefix, server, _ in REGIONS:
    group = prefix + '-rg'
    deploy(group, 'firewall.bicep', dict(serverName=server,outboundIps=sorted(ips)))
    values = dict(DATABASE_URL_EU=urls['eu'], DATABASE_URL_US=urls['us'], CRON_SECRET=secret,
        APP_URL='https://visatransparencypetition.org', NODE_ENV='production', DEV_AUTH='false', DB_SSL='true',
        WEBSITE_SKIP_RUNNING_KUDUAGENT='true', SCM_DO_BUILD_DURING_DEPLOYMENT='false', WEBSITE_RUN_FROM_PACKAGE='1')
    if restricted:
        values.update(DATABASE_READER_URL_EU=readers['eu'], DATABASE_READER_URL_US=readers['us'])
    file_arg(values, lambda f: az('webapp','config','appsettings','set','-g',group,'-n',prefix+'-9a04','--settings',f,'--query','length(@)'))
print('Configured both regions.')
