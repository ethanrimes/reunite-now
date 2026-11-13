"""Refresh the reviewed bill set from GovInfo and official roll calls. No API key required.
Run from repository root. Review editorial metadata and translations before publishing.
"""
import concurrent.futures, datetime, json, pathlib, urllib.request, xml.etree.ElementTree as ET
BILLS=[(119,'hr',10715),(119,'hr',9457),(119,'hr',10711),(119,'hr',6565),(119,'s',3419),(119,'hr',924),(119,'s',398),(119,'hr',4393),(119,'s',2759),(119,'hr',5283),(119,'s',3440),(119,'hr',6670),(119,'hr',2366),(118,'s',2632),(118,'hr',5127),(118,'hr',9545),(118,'hr',6542),(116,'hr',1044),(116,'s',386),(117,'hr',1333),(119,'hr',1),(119,'s',1071)]
HOUSE=[(2019,437,'116-hr-1044'),(2021,127,'117-hr-1333'),(2025,190,'119-hr-1'),(2025,320,'119-s-1071')]
SENATE=[(119,1,372,'119-hr-1'),(119,1,648,'119-s-1071')]
def xml(url):
 with urllib.request.urlopen(url,timeout=60) as r:return ET.fromstring(r.read())
def bill(key):
 c,k,n=key;url=f'https://www.govinfo.gov/bulkdata/BILLSTATUS/{c}/{k}/BILLSTATUS-{c}{k}{n}.xml';b=xml(url).find('bill')
 actions=[]
 for a in b.findall('actions/item'):
  item={'date':a.findtext('actionDate'),'text':a.findtext('text')}
  if item not in actions:actions.append(item)
 return dict(id=f'{c}-{k}-{n}',congress=c,type=k,number=n,title=b.findtext('title'),introduced=b.findtext('introducedDate'),sourceUpdated=b.findtext('updateDate'),latest=dict(date=b.findtext('latestAction/actionDate'),text=b.findtext('latestAction/text')),sponsors=[x.findtext('bioguideId') for x in b.findall('sponsors/item')],cosponsors=[x.findtext('bioguideId') for x in b.findall('cosponsors/item') if not x.findtext('sponsorshipWithdrawnDate')],actions=actions,source=url,url=f'https://www.congress.gov/bill/{c}th-congress/{"house" if k=="hr" else "senate"}-bill/{n}')
def house(key):
 y,n,b=key;url=f'https://clerk.house.gov/evs/{y}/roll{n:03}.xml';r=xml(url);m=r.find('vote-metadata')
 assert m.findtext('legis-num').replace(' ','').lower()==b.split('-',1)[1].replace('-',''), (b,m.findtext('legis-num'))
 return dict(bill=b,chamber='House',roll=n,date=datetime.datetime.strptime(m.findtext('action-date'),'%d-%b-%Y').date().isoformat(),question=m.findtext('vote-question'),result=m.findtext('vote-result'),source=url,url=f'https://clerk.house.gov/Votes/{y}{n}',members={x.find('legislator').get('name-id'):x.findtext('vote') for x in r.findall('vote-data/recorded-vote')})
def senate(key):
 c,s,n,b=key;url=f'https://www.senate.gov/legislative/LIS/roll_call_votes/vote{c}{s}/vote_{c}_{s}_{n:05}.xml';r=xml(url)
 assert r.findtext('document/document_number')==b.split('-')[2]
 # Senate LIS identifiers are mapped to bioguide IDs from the maintained public roster.
 return dict(bill=b,chamber='Senate',roll=n,date=datetime.datetime.strptime(r.findtext('vote_date').split(',')[0]+','+r.findtext('vote_date').split(',')[1],'%B %d, %Y').date().isoformat(),question=r.findtext('vote_question_text'),result=r.findtext('vote_result_text'),source=url,url=url.replace('.xml','.htm'),members={x.findtext('lis_member_id'):x.findtext('vote_cast') for x in r.findall('members/member')},identifier='lis')
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  bills=list(pool.map(bill,BILLS));votes=list(pool.map(house,HOUSE))+list(pool.map(senate,SENATE))
 # Use Node's existing yaml dependency to avoid adding a Python dependency.
 import subprocess
 code="import {parse} from 'yaml';let ids={};for(const name of ['current','historical']){let r=await fetch('https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-'+name+'.yaml');if(!r.ok)throw Error(r.status);for(const l of parse(await r.text()))if(l.id.lis)ids[l.id.lis]=l.id.bioguide;}process.stdout.write(JSON.stringify(ids));"
 ids=json.loads(subprocess.check_output(['node','--input-type=module','-e',code]))
 for v in votes:
  if v.pop('identifier',None)=='lis':
   assert all(k in ids for k in v['members']), 'Unmapped senator; stop rather than guess'
   v['members']={ids[k]:value for k,value in v['members'].items()}
 output={'reviewed':'2026-11-12','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'memberIdSource':'https://github.com/unitedstates/congress-legislators','bills':bills,'votes':votes}
 pathlib.Path('shared/legislation.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
 print(f'Updated {len(bills)} bills and {len(votes)} official roll calls. Editorial review required.')
