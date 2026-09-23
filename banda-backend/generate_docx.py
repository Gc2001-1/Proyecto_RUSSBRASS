from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
import os

root = Path(__file__).resolve().parent
input_file = root / 'WORLD.md'
output_file = root / 'Proyecto_Horas_Sociales.docx'

if not input_file.exists():
    raise FileNotFoundError(f'No se encontró {input_file}')

text = input_file.read_text(encoding='utf-8')
lines = text.splitlines()

paragraphs = []
for raw in lines:
    line = raw.rstrip()
    if not line.strip():
        paragraphs.append('')
        continue
    if line.startswith('# '):
        paragraphs.append(('H1', line[2:].strip()))
    elif line.startswith('## '):
        paragraphs.append(('H2', line[3:].strip()))
    elif line.startswith('### '):
        paragraphs.append(('H3', line[4:].strip()))
    elif line.startswith('- '):
        paragraphs.append(('BULLET', line[2:].strip()))
    elif line.startswith('1. ') or line.startswith('2. ') or line.startswith('3. ') or line.startswith('4. ') or line.startswith('5. '):
        paragraphs.append(('NUM', line))
    else:
        paragraphs.append(('P', line))


def build_xml(paragraphs_list):
    body_parts = []
    for item in paragraphs_list:
        if item == '':
            body_parts.append('<w:p/>')
            continue

        kind, content = item
        if kind == 'H1':
            style = '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
        elif kind == 'H2':
            style = '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'
        elif kind == 'H3':
            style = '<w:pPr><w:pStyle w:val="Heading3"/></w:pPr>'
        elif kind == 'BULLET':
            style = '<w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr>'
            content = '• ' + content
        elif kind == 'NUM':
            style = '<w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr>'
        else:
            style = '<w:pPr><w:pStyle w:val="Normal"/></w:pPr>'

        body_parts.append(f'<w:p>{style}<w:r><w:t xml:space="preserve">{escape(content)}</w:t></w:r></w:p>')

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(body_parts)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>'''

content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>
</w:styles>'''

with ZipFile(output_file, 'w', ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', build_xml(paragraphs))
    z.writestr('word/styles.xml', styles)

print(f'Archivo creado: {output_file}')
