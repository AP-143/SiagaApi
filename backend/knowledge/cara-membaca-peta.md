---
title: Cara membaca peta SiagaApi
source: Dokumentasi proyek SiagaApi
reviewed: 2026-10-16
---

## Apa arti warna dan ukuran titik di peta?

Titik jingga adalah titik api yang tidak berada di lahan gambut. Titik ungu adalah titik api yang berada di lahan gambut. Titik yang lebih besar dan lebih pekat berarti tingkat kepercayaan (confidence) yang lebih tinggi. Area ungu transparan menunjukkan sebaran lahan gambut, garis tebal adalah batas provinsi, dan garis tipis putus-putus adalah batas kabupaten/kota. Lapisan ini bisa dinyalakan atau dimatikan di panel Lapisan.

## Bagaimana SiagaApi menentukan sebuah titik api berada di lahan gambut?

Sebuah titik api dianggap berada di lahan gambut jika titik tengahnya jatuh di dalam poligon lahan gambut. SiagaApi tidak memakai zona penyangga (buffer), jadi titik api yang berada tepat di tepi lahan gambut bisa terlewat. Penandaan ini hanya ya atau tidak; kedalaman gambut belum dipakai.

## Dari mana data di peta SiagaApi berasal?

Titik api berasal dari NASA FIRMS, memakai satelit VIIRS dengan piksel sekitar 375 meter (Suomi NPP, NOAA-20, dan NOAA-21). Batas provinsi dan kabupaten/kota berasal dari OCHA dan BPS (COD-AB Indonesia, data tahun 2020). Peta lahan gambut berasal dari Kementerian Pertanian (BBSDLP) melalui BIG Satu Peta. Citra satelit berasal dari NASA GIBS.

## Mengapa titik api berkepercayaan rendah disembunyikan?

SiagaApi menyembunyikan titik berkepercayaan rendah (low confidence) secara default untuk mengurangi titik yang kemungkinan keliru, tetapi datanya tetap disimpan. Aktifkan "Tampilkan kepercayaan rendah" di panel Filter untuk menampilkannya.

## Setelah berapa lama banner peringatan di peta muncul?

Peta menampilkan banner peringatan jika pembaruan data terakhir yang berhasil sudah lebih dari 6 jam yang lalu. Peringatan ini penting agar tidak salah mengira bahwa tidak adanya titik api berarti aman, padahal data berhenti masuk.

## Jam di peta memakai zona waktu apa?

Waktu deteksi di jendela rincian titik memakai zona waktu provinsinya: WIB untuk Kalimantan Barat dan Kalimantan Tengah, WITA untuk Kalimantan Selatan, Timur, dan Utara. Waktu pembaruan data terakhir ditampilkan dalam WIB.

## Seberapa tepat garis batas wilayah di peta?

Garis batas yang digambar di peta adalah salinan yang disederhanakan agar ringan, jadi bisa meleset beberapa ratus meter dari batas sebenarnya. Penentuan titik api masuk wilayah mana memakai batas yang lebih rinci, sehingga keterangan wilayah pada titik tetap akurat.

## Apa arti jumlah titik api per kabupaten/kota?

Angka itu adalah jumlah titik api dalam rentang waktu dan filter yang sedang dipilih, bukan jumlah kebakaran. SiagaApi tidak menggabungkan titik dari satelit atau lintasan yang berbeda, jadi api yang sama bisa tercatat lebih dari sekali. Angka yang sama muncul di panel Ringkasan dan dalam jawaban chat untuk filter yang sama.
