"""Configure the Azure-only daily reminder schedule without printing its secret."""
import json, os, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
SUB = '9a04b64b-af19-4519-be50-56ec2acbd855'
RG = 'reunite-now-rg'
result = subprocess.run(['az','webapp','config','appsettings','list','-g',RG,'-n','reunite-now-9a04','--subscription',SUB,'-o','json'],check=True,capture_output=True,text=True)
settings = {x['name']:x['value'] for x in json.loads(result.stdout)}
private = ROOT / '.local'
private.mkdir(exist_ok=True)
os.chmod(private,0o700)
params = private / 'reminder-parameters.json'
params.write_text(json.dumps({'cronSecret':{'value':settings['CRON_SECRET']},'appUrl':{'value':settings['APP_URL']}}))
os.chmod(params,0o600)
try:
 subprocess.run(['az','deployment','group','create','-g',RG,'-n','reunite-now-reminders','--template-file',str(ROOT/'infra/reminders.bicep'),'--parameters','@'+str(params),'--subscription',SUB,'-o','none'],check=True,capture_output=True)
finally:
 params.unlink()
print('Azure daily reminder schedule configured for 16:00 UTC.')
