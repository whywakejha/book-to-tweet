import zipfile, os
os.makedirs('/home/oai/share/epub_card_app', exist_ok=True)
with zipfile.ZipFile('/home/oai/share/epub_card_app/sample.epub', 'w') as epub:
    # Add mimetype file with no compression
    epub.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
    # Add META-INF/container.xml
    epub.writestr('META-INF/container.xml', '''<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>
''')
    # Add content.opf
    epub.writestr('content.opf', '''<?xml version="1.0" encoding="utf-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">id12345</dc:identifier>
    <dc:title>Sample Book</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1" />
  </spine>
</package>
''')
    # Add a simple chapter1.xhtml
    epub.writestr('chapter1.xhtml', '''<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head><title>Chapter 1</title></head>
  <body><p>Hello world! This is a simple EPUB test. It's long enough to check segmentation into 160 characters. Keep adding some text for test. Adding more sentences to exceed 160 characters. Another sentence to ensure enough content for multiple cards. And again some more filler text to complete the test of the card splitting algorithm. End.</p></body>
</html>
''')
