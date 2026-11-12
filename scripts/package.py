"""Create a portable App Service package from a verified local build."""
import pathlib,shutil,subprocess,json,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
stage=root/'work'/'deploy';stage.mkdir(parents=True,exist_ok=True)
for name in ['dist','public']:
 target=stage/name
 if target.exists():shutil.rmtree(target)
 shutil.copytree(root/name,target)
for name in ['package.json','package-lock.json']:shutil.copy2(root/name,stage/name)
subprocess.run(['npm','ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],cwd=stage,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
job=stage/'App_Data/jobs/triggered/monthly-reminders';job.mkdir(parents=True,exist_ok=True)
for name in ['run.js','settings.job']:shutil.copy2(root/'infra/webjob'/name,job/name)
archive=root/'work'/'reunite-now.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in stage.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(stage))
print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size}))
