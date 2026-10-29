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


from app.chat.repair import repair_words


def test_a_missing_extra_or_swapped_letter_is_repaired():
    vocab = {"masker", "hotspot", "terakhir"}
    assert repair_words("maskr", set(), vocab).text == "masker"      # a letter missing
    assert repair_words("maskerr", set(), vocab).text == "masker"    # a letter too many
    assert repair_words("hotpsot", set(), vocab).text == "hotspot"   # two letters swapped


def test_an_ordinary_word_one_substituted_letter_from_a_known_word_is_left_alone():
    # "susah" is a real word; "sudah" is a different real word, so changing it would be a guess.
    vocab = {"sudah", "berapa", "bulan", "kapan"}
    for word in ["susah", "berada", "bulat", "kapal"]:
        assert repair_words(word, set(), vocab).text == word


from app.chat.repair import looks_damaged


def test_a_question_with_a_nearly_known_word_or_a_very_long_run_of_letters_looks_damaged():
    assert looks_damaged("brapa ttk apii di sambas", {"sambas"})
    assert looks_damaged("apa yang sebaiknya dilakukan saat kbut", {"sambas"}, {"kabut", "asap"})
    assert looks_damaged("a" * 15, set())


def test_a_well_written_question_about_something_else_does_not_look_damaged():
    assert not looks_damaged("bagaimana cara membuat kue brownies yang enak", {"sambas"})
    assert not looks_damaged("obat apa yang bagus untuk batuk akibat asap", {"sambas"}, {"asap"})


def test_the_damage_check_looks_at_a_bounded_number_of_words_however_long_the_message():
    import time

    vocabulary = {f"{a}{b}{c}{d}" for a in "abcdefghij" for b in "aeiou" for c in "klmnprst" for d in "aeiou"}
    message = " ".join(["xqzvw"] * 250)  # 500 characters, none of them a known word

    started = time.perf_counter()
    looks_damaged(message, set(), vocabulary)

    assert time.perf_counter() - started < 1.0


def test_the_words_of_the_documents_are_read_again_only_when_the_documents_change(database_url, tmp_path):
    import psycopg

    from app.knowledge import document_words, load_knowledge

    def write(text):
        folder = tmp_path / "docs"
        folder.mkdir(exist_ok=True)
        (folder / "a.md").write_text(
            f"---\ntitle: Uji\nsource: Sumber uji\nreviewed: 2026-02-03\n---\n\n## Judul uji?\n\n{text}\n",
            encoding="utf-8",
        )
        return folder

    with psycopg.connect(database_url) as conn:
        load_knowledge(conn, write("Gambut menyimpan karbon."))
        first = document_words(conn)
        assert "gambut" in first and "karbon" in first
        assert document_words(conn) is first  # nothing changed, so nothing was read again

        load_knowledge(conn, write("Mangrove menahan abrasi."))
        second = document_words(conn)
        assert "mangrove" in second and "gambut" not in second
