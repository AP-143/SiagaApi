---
title: Tentang titik api (hotspot) dari satelit
source: NASA FIRMS, Pertanyaan Umum (FAQ)
url: https://www.earthdata.nasa.gov/data/tools/firms/faq
reviewed: 2026-10-16
---

## Apa itu titik api (hotspot)?

Titik api, atau hotspot (sering juga disebut titik panas), adalah hasil deteksi satelit. Setiap titik mewakili pusat sebuah piksel yang ditandai mengandung satu atau lebih kebakaran atau anomali panas lain, misalnya gunung berapi. Pada satelit VIIRS yang dipakai SiagaApi, piksel itu berukuran sekitar 375 meter. Jadi titik api adalah tanda kemungkinan kebakaran, bukan bukti bahwa kebakaran sudah terkonfirmasi.

## Apakah titik api (hotspot) sama dengan kebakaran?

Tidak selalu. Satelit mendeteksi anomali panas, dan satu titik adalah tanda bahwa kemungkinan ada api, bukan kepastian. NASA mencatat bahwa deteksi bisa berasal dari anomali panas lain, dan bahwa ada deteksi janggal, misalnya akibat manuver kalibrasi satelit atau asap yang sangat panas pada malam hari. NASA berusaha menyaringnya, tetapi pada kesempatan langka ada yang sempat muncul sementara di data. Karena itu SiagaApi menyebutnya deteksi satelit, dan keberadaan api di lapangan baru pasti setelah dicek langsung.

## Seberapa akurat lokasi titik api?

Lokasi sebuah titik adalah titik tengah piksel, belum tentu koordinat api yang sebenarnya. Pada VIIRS pikselnya sekitar 375 meter, dan ukuran sebenarnya berubah menurut sudut pindai satelit. NASA menyatakan tidak bisa menentukan lokasi dan ukuran api secara tepat; yang diketahui hanyalah bahwa setidaknya ada satu api di dalam piksel yang ditandai.

## Apakah satu kebakaran bisa tercatat sebagai beberapa titik api?

Bisa. NASA mencatat bahwa kadang terlihat beberapa titik api berjajar dalam satu garis, dan ini umumnya menunjukkan garis depan api (fire front). NASA juga menyebut api sering lebih kecil daripada piksel yang ditandai, dan ukuran api tidak dapat ditentukan dari satu titik. Karena itu jumlah titik api tidak sama dengan jumlah kebakaran.

## Mengapa api bisa tidak terdeteksi satelit?

Menurut NASA, api bisa luput terdeteksi karena beberapa sebab. Api mungkin mulai dan padam di antara dua pengamatan satelit. Awan, asap tebal, atau tajuk pohon dapat menutupi api sepenuhnya. Sesekali instrumen satelit tidak beroperasi. Api juga mungkin terlalu kecil atau terlalu dingin untuk terdeteksi. Karena itu, tidak adanya titik api di peta tidak membuktikan bahwa tidak ada api.

## Seberapa sering data titik api diperbarui?

Data berasal dari satelit orbit kutub (VIIRS pada Suomi NPP serta NOAA-20 dan NOAA-21) yang umumnya melintas dua kali sehari di satu wilayah. NASA menyediakan data hampir real-time (near real-time) dalam waktu 3 jam setelah pengamatan, dengan upaya terbaik. SiagaApi mengambil data dari NASA setiap 30 menit. Jadi peta bisa tertinggal beberapa jam dari keadaan sebenarnya, dan titik baru muncul ketika satelit melintas.

## Apa arti tingkat kepercayaan (confidence) titik api?

Untuk VIIRS, nilai kepercayaan (confidence) ada tiga: rendah (low), sedang (nominal), dan tinggi (high). Menurut NASA, titik berkepercayaan rendah pada siang hari biasanya terkait pantulan sinar matahari (sun glint) dan anomali suhu yang lebih kecil, kurang dari 15 K pada kanal inframerah I4. Titik berkepercayaan sedang bebas dari kemungkinan pantulan matahari pada siang hari dan memiliki anomali suhu kuat, lebih dari 15 K, siang atau malam. Titik berkepercayaan tinggi terkait piksel yang jenuh (saturated), siang atau malam. NASA juga menegaskan tidak ada batas ideal yang berlaku untuk semua keperluan, dan nilai ini sebaiknya dipakai dengan hati-hati.
