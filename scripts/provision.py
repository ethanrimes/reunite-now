"""Provision only the isolated Reunite Now resource group; never print secrets."""
import json, subprocess, secrets, pathlib, os
ROOT=pathlib.Path(__file__).resolve().parents[1]
SUB='9a04b64b-af19-4519-be50-56ec2acbd855'
RG='reunite-now-rg'
def az(*args,output=True):
 result=subprocess.run(['az',*args,'--subscription',SUB,'-o','json' if output else 'none'],capture_output=True,text=True)
 if result.returncode:
  print(result.stderr.replace(globals().get('password','<none>'),'[REDACTED]'),flush=True)
  raise RuntimeError('Azure operation failed')
 return json.loads(result.stdout) if output and result.stdout.strip() else None
private=ROOT/'.local';private.mkdir(exist_ok=True);os.chmod(private,0o700)
params=private/'provision-parameters.json'
if not params.exists():
 params.write_text(json.dumps({'databasePassword':{'value':secrets.token_urlsafe(36)}}));os.chmod(params,0o600)
password=json.loads(params.read_text())['databasePassword']['value']
print('Deploying isolated Azure application and database...',flush=True)
if '--resume' not in __import__('sys').argv:
 az('deployment','group','create','--resource-group',RG,'--name','reunite-now-infrastructure','--template-file',str(ROOT/'infra/main.bicep'),'--parameters','@'+str(params),output=False)
app=az('webapp','show','-g',RG,'-n','reunite-now-9a04')
ips=sorted(set(app['possibleOutboundIpAddresses'].split(',')))
firewall=private/'firewall-parameters.json'
firewall.write_text(json.dumps({'outboundIps':{'value':ips}}))
az('deployment','group','create','--resource-group',RG,'--name','reunite-now-firewall','--template-file',str(ROOT/'infra/firewall.bicep'),'--parameters','@'+str(firewall),output=False)
firewall.unlink()
settings=private/'app-settings.json'
settings.write_text(json.dumps({'NODE_ENV':'production','APP_URL':'https://'+app['defaultHostName'],'DATABASE_URL':f'postgresql://reunite_admin:{password}@reunite-now-pg-9a04.postgres.database.azure.com:5432/reunite_now','DB_SSL':'true','CRON_SECRET':secrets.token_urlsafe(48),'DEV_AUTH':'false','WEBSITE_SKIP_RUNNING_KUDUAGENT':'true','SCM_DO_BUILD_DURING_DEPLOYMENT':'false','WEBSITE_RUN_FROM_PACKAGE':'1'}));os.chmod(settings,0o600)
az('webapp','config','appsettings','set','-g',RG,'-n',app['name'],'--settings','@'+str(settings),output=False)
settings.unlink();params.unlink()
print(json.dumps({'app':app['name'],'url':'https://'+app['defaultHostName'],'resourceGroup':RG,'database':'reunite-now-pg-9a04','firewall':'App Service outbound IPs only'}))
