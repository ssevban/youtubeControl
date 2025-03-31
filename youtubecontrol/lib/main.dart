import 'dart:io';

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:intl/intl.dart';
import 'firebase_options.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:async/async.dart' show StreamGroup;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Veritabanı bağlantısını test et
  try {
    final ref = FirebaseDatabase.instance.ref();
    await ref.child('test').set({'test': 'test'});
    print('Veritabanı bağlantısı başarılı');
  } catch (e) {
    print('Veritabanı bağlantı hatası: $e');
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'YouTube Kontrol',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        colorScheme: ColorScheme.dark(
          primary: Color(0xFF1F1F1F),
          secondary: Colors.red,
          surface: Color(0xFF121212),
          background: Color(0xFF121212),
        ),
        scaffoldBackgroundColor: Color(0xFF121212),
        cardTheme: CardTheme(
          color: Color(0xFF1F1F1F),
          elevation: 2,
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: Color(0xFF1DB954),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      home: const VideoListPage(),
    );
  }
}

class VideoListPage extends StatelessWidget {
  const VideoListPage({super.key});

  // Video ekleme fonksiyonu - static yapalım
  static Future<void> addVideo(String title, String status) async {
    try {
      final DatabaseReference _database =
          FirebaseDatabase.instance.ref().child('videos');
      await _database.push().set({
        'title': title,
        'status': status,
        'lastUpdate': ServerValue.timestamp,
      });
    } catch (e) {
      print('Veri ekleme hatası: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'youtube - music video controller',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w500,
          ),
        ),
        centerTitle: true,
      ),
      body: StreamBuilder(
        // İki veritabanını da dinleyelim
        stream: StreamGroup.merge([
          FirebaseDatabase.instance.ref().child('musicTracks').onValue,
          FirebaseDatabase.instance.ref().child('youtubeVideos').onValue,
        ]),
        builder: (context, AsyncSnapshot<DatabaseEvent> snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Bir hata oluştu'));
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          // Müzik ve video verilerini ayrı ayrı alalım
          final musicRef = FirebaseDatabase.instance.ref().child('musicTracks');
          final videoRef =
              FirebaseDatabase.instance.ref().child('youtubeVideos');

          return FutureBuilder(
            future: Future.wait([
              musicRef.get(),
              videoRef.get(),
            ]),
            builder: (context, AsyncSnapshot<List<DataSnapshot>> snapshot) {
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }

              // Müzik ve video verilerini alalım
              final musicData =
                  snapshot.data![0].value as Map<dynamic, dynamic>? ?? {};
              final videoData =
                  snapshot.data![1].value as Map<dynamic, dynamic>? ?? {};

              // Tüm verileri bir listede birleştirelim
              final musicItems = musicData.entries.map((e) {
                final status = ((e.value as Map)['status'] ?? 'pause')
                    .toString()
                    .toLowerCase();
                return MapEntry(e.key, {
                  ...e.value as Map<dynamic, dynamic>,
                  'type': 'music',
                  'status': status,
                });
              }).toList();

              final videoItems = videoData.entries.map((e) {
                final status = ((e.value as Map)['status'] ?? 'pause')
                    .toString()
                    .toLowerCase();
                return MapEntry(e.key, {
                  ...e.value as Map<dynamic, dynamic>,
                  'type': 'video',
                  'status': status,
                });
              }).toList();

              // Müzikleri ve videoları ayrı ayrı tutalım ve birleştirelim
              final allItems = [
                ...musicItems, // Müzikler her zaman önce
                ...videoItems, // Videolar sonra ve kendi sıralarında
              ];

              return Column(
                children: [
                  const SizedBox(height: 10),
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: () async {
                        // Verileri yenilemek için Future.delayed ekleyelim
                        await Future.delayed(const Duration(milliseconds: 500));
                        // setState yerine StreamBuilder otomatik olarak yenileyecek
                      },
                      child: ListView.builder(
                        padding: const EdgeInsets.all(8),
                        itemCount: allItems.length,
                        itemBuilder: (context, index) {
                          final item = allItems[index];
                          final itemData = item.value;
                          final isMusic = itemData['type'] == 'music';

                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                ListTile(
                                  leading: SizedBox(
                                    width: 50,
                                    height: 50,
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.network(
                                        itemData['thumbnail'] ??
                                            'https://via.placeholder.com/50',
                                        fit: BoxFit.cover,
                                        width: 50,
                                        height: 50,
                                        errorBuilder:
                                            (context, error, stackTrace) {
                                          return Icon(
                                            isMusic
                                                ? Icons.music_note
                                                : Icons.play_circle_outline,
                                            color: isMusic
                                                ? Colors.blue
                                                : Colors.red,
                                            size: 30,
                                          );
                                        },
                                      ),
                                    ),
                                  ),
                                  title: Text(
                                    (itemData['title'] ?? 'Başlıksız')
                                                .toString()
                                                .length >
                                            50
                                        ? '${(itemData['title'] ?? 'Başlıksız').toString().substring(0, 50)}...'
                                        : (itemData['title'] ?? 'Başlıksız')
                                            .toString(),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 18,
                                    ),
                                  ),
                                  subtitle: Text(
                                    isMusic ? 'Music' : 'YouTube',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey,
                                    ),
                                  ),
                                  trailing: SizedBox(
                                    width: 140,
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        SizedBox(
                                          width: 35,
                                          child: IconButton(
                                            padding: EdgeInsets.zero,
                                            visualDensity:
                                                VisualDensity.compact,
                                            icon: const Icon(
                                                Icons.skip_previous,
                                                size: 20),
                                            onPressed: () async {
                                              await FirebaseDatabase.instance
                                                  .ref()
                                                  .child(isMusic
                                                      ? 'musicTracks'
                                                      : 'youtubeVideos')
                                                  .child(item.key)
                                                  .update({
                                                'status': 'previous',
                                              });
                                            },
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        SizedBox(
                                          width: 35,
                                          child: IconButton(
                                            padding: EdgeInsets.zero,
                                            visualDensity:
                                                VisualDensity.compact,
                                            icon: Icon(
                                              itemData['status']
                                                      .toString()
                                                      .toLowerCase()
                                                      .contains('play')
                                                  ? Icons.pause_circle
                                                  : Icons.play_circle,
                                              color: itemData['status']
                                                      .toString()
                                                      .toLowerCase()
                                                      .contains('play')
                                                  ? Colors.green
                                                  : Colors.orange,
                                              size: 24,
                                            ),
                                            onPressed: () async {
                                              // Debug için mevcut durumu yazdıralım
                                              print(
                                                  'Mevcut durum: ${itemData['status']}');

                                              // Status kontrolünü düzeltelim
                                              final currentStatus =
                                                  itemData['status']
                                                      .toString()
                                                      .toLowerCase();
                                              final newStatus =
                                                  currentStatus.contains('play')
                                                      ? 'pause'
                                                      : 'play';

                                              print('Yeni durum: $newStatus');

                                              try {
                                                final databaseRef =
                                                    FirebaseDatabase
                                                        .instance
                                                        .ref()
                                                        .child(isMusic
                                                            ? 'musicTracks'
                                                            : 'youtubeVideos')
                                                        .child(item.key);

                                                await databaseRef.update({
                                                  'status': newStatus,
                                                  'timestamp': DateFormat(
                                                          'dd.MM.yyyy HH:mm:ss')
                                                      .format(DateTime.now()),
                                                });
                                                print(
                                                    'Güncelleme başarılı: $newStatus');
                                              } catch (e) {
                                                print(
                                                    'Status güncelleme hatası: $e');
                                              }
                                            },
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        SizedBox(
                                          width: 35,
                                          child: IconButton(
                                            padding: EdgeInsets.zero,
                                            visualDensity:
                                                VisualDensity.compact,
                                            icon: const Icon(Icons.skip_next,
                                                size: 20),
                                            onPressed: () async {
                                              await FirebaseDatabase.instance
                                                  .ref()
                                                  .child(isMusic
                                                      ? 'musicTracks'
                                                      : 'youtubeVideos')
                                                  .child(item.key)
                                                  .update({
                                                'status': 'next',
                                              });
                                            },
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
