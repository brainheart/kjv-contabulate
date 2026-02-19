"""Sanity checks on build output (docs/data/*.json).
Run with: python3 -m pytest tests/test_build_output.py -v
Or:       python3 -m unittest tests.test_build_output -v
"""
import unittest
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / 'docs' / 'data'
LINES_DIR = Path(__file__).parent.parent / 'docs' / 'lines'


class TestBuildOutputExists(unittest.TestCase):
    """Verify all expected data files exist."""

    EXPECTED_FILES = [
        'plays.json', 'chunks.json', 'characters.json',
        'tokens.json', 'tokens2.json', 'tokens3.json',
        'tokens_char.json', 'tokens_char2.json', 'tokens_char3.json',
    ]

    def test_all_data_files_exist(self):
        for f in self.EXPECTED_FILES:
            self.assertTrue((DATA_DIR / f).exists(), f'{f} must exist in docs/data/')

    def test_lines_file_exists(self):
        self.assertTrue((LINES_DIR / 'all_lines.json').exists(), 'all_lines.json must exist')


class TestPlays(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_DIR / 'plays.json') as f:
            cls.plays = json.load(f)

    def test_37_plays(self):
        self.assertEqual(len(self.plays), 37)

    def test_play_has_required_fields(self):
        required = {'play_id', 'title', 'abbr', 'genre', 'total_words', 'total_lines', 'num_acts', 'num_scenes'}
        for p in self.plays:
            self.assertTrue(required.issubset(p.keys()), f"Play {p.get('title', '?')} missing fields: {required - set(p.keys())}")

    def test_all_plays_have_5_acts(self):
        for p in self.plays:
            self.assertEqual(p['num_acts'], 5, f"{p['title']} has {p['num_acts']} acts, expected 5")

    def test_genres_are_valid(self):
        valid = {'comedy', 'tragedy', 'history', 'romance'}
        for p in self.plays:
            self.assertIn(p['genre'], valid, f"{p['title']} has unknown genre '{p['genre']}'")

    def test_unique_play_ids(self):
        ids = [p['play_id'] for p in self.plays]
        self.assertEqual(len(ids), len(set(ids)), 'play_ids must be unique')

    def test_unique_abbreviations(self):
        abbrs = [p['abbr'] for p in self.plays]
        self.assertEqual(len(abbrs), len(set(abbrs)), 'abbreviations must be unique')


class TestChunks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_DIR / 'chunks.json') as f:
            cls.chunks = json.load(f)
        with open(DATA_DIR / 'plays.json') as f:
            cls.play_ids = {p['play_id'] for p in json.load(f)}

    def test_has_chunks(self):
        self.assertGreater(len(self.chunks), 700)

    def test_chunk_has_required_fields(self):
        required = {'scene_id', 'play_id', 'act', 'scene', 'total_words'}
        for c in self.chunks[:10]:
            self.assertTrue(required.issubset(c.keys()), f"Chunk {c.get('scene_id')} missing fields")

    def test_all_chunks_reference_valid_plays(self):
        for c in self.chunks:
            self.assertIn(c['play_id'], self.play_ids, f"Chunk {c['scene_id']} references unknown play_id {c['play_id']}")

    def test_unique_scene_ids(self):
        ids = [c['scene_id'] for c in self.chunks]
        self.assertEqual(len(ids), len(set(ids)), 'scene_ids must be unique')


class TestTokens(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_DIR / 'tokens.json') as f:
            cls.tokens = json.load(f)
        with open(DATA_DIR / 'tokens2.json') as f:
            cls.tokens2 = json.load(f)
        with open(DATA_DIR / 'tokens3.json') as f:
            cls.tokens3 = json.load(f)

    def test_unigrams_count(self):
        self.assertGreater(len(self.tokens), 20000)

    def test_bigrams_count(self):
        self.assertGreater(len(self.tokens2), 200000)

    def test_trigrams_count(self):
        self.assertGreater(len(self.tokens3), 400000)

    def test_common_words_present(self):
        for word in ['the', 'love', 'death', 'king', 'lord']:
            self.assertIn(word, self.tokens, f"'{word}' should be in unigrams")

    def test_posting_format(self):
        """Each posting should be [scene_id, count]."""
        for word in ['the', 'love']:
            postings = self.tokens[word]
            self.assertIsInstance(postings, list)
            self.assertGreater(len(postings), 0)
            for p in postings[:5]:
                self.assertIsInstance(p, list)
                self.assertEqual(len(p), 2)
                self.assertIsInstance(p[0], int)  # scene_id
                self.assertIsInstance(p[1], int)  # count


class TestCharacters(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_DIR / 'characters.json') as f:
            cls.chars = json.load(f)

    def test_has_characters(self):
        self.assertGreater(len(self.chars), 1000)

    def test_character_has_required_fields(self):
        required = {'character_id', 'play_id', 'name', 'total_words_spoken'}
        for c in self.chars[:10]:
            self.assertTrue(required.issubset(c.keys()), f"Character {c.get('name')} missing fields")

    def test_hamlet_exists(self):
        hamlets = [c for c in self.chars if c['name'].upper() == 'HAMLET']
        self.assertGreater(len(hamlets), 0, 'Hamlet should exist as a character')


if __name__ == '__main__':
    unittest.main()
