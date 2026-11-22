"""Create a portable App Service package from a verified local build."""
import pathlib,shutil,subprocess,json,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
stage=root/'work'/'deploy'
if stage.exists():shutil.rmtree(stage)
stage.mkdir(parents=True)
for name in ['dist','public']:
 target=stage/name
 if target.exists():shutil.rmtree(target)
 shutil.copytree(root/name,target)
shutil.copytree(root/"server"/"data", stage/"server"/"data")
# Install the locked Linux production dependencies, including sharp's native decoder.
for name in ['package.json', 'package-lock.json']:
 shutil.copy2(root/name, stage/name)
subprocess.run(['npm','ci','--omit=dev','--include=optional','--ignore-scripts','--os=linux','--cpu=x64','--libc=glibc','--no-audit','--no-fund'], cwd=stage, check=True)
if not (stage/'node_modules/@img/sharp-linux-x64').is_dir():
 raise RuntimeError('The Linux image decoder is missing')
archive=root/'work'/'reunite-now.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in stage.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(stage))
print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size}))
