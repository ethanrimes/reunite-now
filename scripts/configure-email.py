"""Connect the project's Azure-managed email domain; no message is sent."""
import subprocess,json,pathlib,os
RG='reunite-now-rg';SUB='9a04b64b-af19-4519-be50-56ec2acbd855'
BASE=f'https://management.azure.com/subscriptions/{SUB}/resourceGroups/{RG}/providers/Microsoft.Communication'
def az(*args):
 r=subprocess.run(['az',*args,'--subscription',SUB,'-o','json'],capture_output=True,text=True,check=True)
 return json.loads(r.stdout)
domain=az('rest','--method','get','--url',BASE+'/emailServices/reunite-now-email/domains/AzureManagedDomain?api-version=2023-04-01')
keys=az('rest','--method','post','--url',BASE+'/communicationServices/reunite-now-communication/listKeys?api-version=2023-04-01')
config={'AZURE_COMMUNICATION_CONNECTION_STRING':keys['primaryConnectionString'],'EMAIL_FROM':'DoNotReply@'+domain['properties']['mailFromSenderDomain']}
p=pathlib.Path('.local/email-settings.json');p.write_text(json.dumps(config));os.chmod(p,0o600)
try:
 subprocess.run(['az','webapp','config','appsettings','set','-g',RG,'-n','reunite-now-9a04','--settings','@'+str(p),'--subscription',SUB,'-o','none'],check=True,capture_output=True)
finally:p.unlink()
print(json.dumps({'sender':config['EMAIL_FROM'],'domainState':domain['properties']['provisioningState'],'tracking':domain['properties'].get('userEngagementTracking'),'messagesSent':0}))
