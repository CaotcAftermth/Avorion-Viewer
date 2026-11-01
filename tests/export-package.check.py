import zipfile,xml.etree.ElementTree as E,json
from pathlib import Path
p=Path('test-results/exports/export-fixture.3mf')
with zipfile.ZipFile(p) as z:
 assert z.testzip() is None
 root=E.fromstring(z.read('3D/3dmodel.model')); ns={'m':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
 assert root.attrib['unit']=='millimeter'
 objects=root.findall('.//m:object',ns); assert len(objects)==1
 for o in objects:
  vertices=o.findall('.//m:vertex',ns)
  for t in o.findall('.//m:triangle',ns):
   assert all(0<=int(t.attrib[k])<len(vertices) for k in ['v1','v2','v3'])
 E.fromstring(z.read('[Content_Types].xml'));E.fromstring(z.read('_rels/.rels'))
 assert json.loads(z.read('Metadata/avorion.json'))['blocks'][0]['secondaryColor']=='00000000'
 print('Python ZIP CRC, 3MF units, XML, references and secondaryColor: passed')
