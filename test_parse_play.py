import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

import build


class KJVSourceSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = Path(__file__).parent / "osis" / "eng-kjv.osis.xml"
        cls.root = ET.parse(cls.source).getroot()

    def test_allowed_books_excludes_apocrypha(self):
        books = list(build.iter_allowed_books(self.root))
        self.assertEqual(len(books), 66)
        abbrs = [book.attrib.get("osisID") for _, book in books]
        self.assertNotIn("Tob", abbrs)
        self.assertIn("Gen", abbrs)
        self.assertIn("Matt", abbrs)

    def test_extract_john_3_16(self):
        john = None
        for testament, book in build.iter_allowed_books(self.root):
            if testament == "New Testament" and book.attrib.get("osisID") == "John":
                john = book
                break
        self.assertIsNotNone(john)
        verses = build.extract_verses(john)
        by_id = {verse["osis_id"]: verse["text"] for verse in verses}
        self.assertIn("John.3.16", by_id)
        self.assertIn("For God so loved the world", by_id["John.3.16"])

    def test_extract_revelation_handles_split_quote_markup(self):
        revelation = None
        for testament, book in build.iter_allowed_books(self.root):
            if testament == "New Testament" and book.attrib.get("osisID") == "Rev":
                revelation = book
                break
        self.assertIsNotNone(revelation)
        verses = build.extract_verses(revelation)
        by_id = {verse["osis_id"]: verse["text"] for verse in verses}
        self.assertIn("Rev.1.8", by_id)
        self.assertIn("I am Alpha and Omega", by_id["Rev.1.8"])
        self.assertIn("the Almighty", by_id["Rev.1.8"])


if __name__ == "__main__":
    unittest.main()
