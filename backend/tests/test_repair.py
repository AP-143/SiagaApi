"""The splitting of a run of letters into known words, on its own: ties and cost."""

import time

from app.chat.repair import segment

WORDS = {"titik", "api", "di", "sambas", "kota", "baru", "kotabaru", "ada", "berapa", "apa", "itu", "ini", "nya"}


def test_a_run_of_known_words_is_split_into_them():
    assert segment("titikapidisambas", WORDS) == ["titik", "api", "di", "sambas"]


def test_fewest_pieces_and_longest_words_win():
    # "kotabaru" is itself a known word, so it is one piece, not "kota" + "baru".
    assert segment("apidikotabaru", WORDS) == ["api", "di", "kotabaru"]


def test_a_split_that_can_be_read_two_ways_is_not_guessed():
    words = {"ab", "c", "a", "bc"}
    # "abc" = ab + c or a + bc: two pieces each, the same lengths, so neither is chosen.
    assert segment("abc", words) is None


def test_letters_that_are_not_made_of_known_words_are_not_split():
    assert segment("qwxzvrtyuop", WORDS) is None


def test_a_message_at_the_limit_is_split_quickly():
    token = "titikapi" * 62  # about 500 letters
    start = time.perf_counter()
    pieces = segment(token, WORDS)

    assert pieces is not None and pieces[:2] == ["titik", "api"]
    assert time.perf_counter() - start < 1.0
