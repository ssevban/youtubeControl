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

class VideoListPage extends StatefulWidget {
  const VideoListPage({super.key});

  @override
  State<VideoListPage> createState() => _VideoListPageState();
}

class _VideoListPageState extends State<VideoListPage> {
  List<MapEntry<dynamic, Map<dynamic, dynamic>>> _items = [];

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

              final musicData =
                  snapshot.data![0].value as Map<dynamic, dynamic>? ?? {};
              final videoData =
                  snapshot.data![1].value as Map<dynamic, dynamic>? ?? {};

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

              _items = [...musicItems, ...videoItems];

              return Column(
                children: [
                  const SizedBox(height: 10),
                  Expanded(
                    child: RefreshIndicator(
                      color: Colors.green,
                      backgroundColor: Color(0xFF1F1F1F),
                      onRefresh: () async {
                        try {
                          await Future.wait([
                            FirebaseDatabase.instance
                                .ref()
                                .child('musicTracks')
                                .get(),
                            FirebaseDatabase.instance
                                .ref()
                                .child('youtubeVideos')
                                .get(),
                          ]);
                        } catch (e) {
                          print('Yenileme hatası: $e');
                        }
                      },
                      child: ListView.builder(
                        padding: const EdgeInsets.all(8),
                        itemCount: _items.length,
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          final itemData = item.value;
                          final isMusic = itemData['type'] == 'music';

                          return Dismissible(
                            key: Key(item.key),
                            background: Container(
                              color: Colors.red,
                              alignment: Alignment.centerRight,
                              padding: EdgeInsets.only(right: 16),
                              child: Icon(
                                Icons.delete,
                                color: Colors.white,
                              ),
                            ),
                            direction: DismissDirection.endToStart,
                            confirmDismiss: (direction) async {
                              return await showDialog(
                                context: context,
                                builder: (BuildContext context) {
                                  return AlertDialog(
                                    backgroundColor: Color(0xFF1F1F1F),
                                    title: Text(
                                      'Silmeyi Onayla',
                                      style: TextStyle(color: Colors.white),
                                    ),
                                    content: Text(
                                      'Bu öğeyi silmek istediğinizden emin misiniz?',
                                      style: TextStyle(color: Colors.white70),
                                    ),
                                    actions: <Widget>[
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.of(context).pop(false),
                                        child: Text(
                                          'İptal',
                                          style: TextStyle(color: Colors.grey),
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.of(context).pop(true),
                                        child: Text(
                                          'Sil',
                                          style: TextStyle(color: Colors.red),
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              );
                            },
                            onDismissed: (direction) {
                              setState(() {
                                _items.removeAt(index);
                              });

                              FirebaseDatabase.instance
                                  .ref()
                                  .child(
                                      isMusic ? 'musicTracks' : 'youtubeVideos')
                                  .child(item.key)
                                  .remove()
                                  .catchError((error) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                        'Silme işlemi başarısız oldu: $error'),
                                    backgroundColor: Colors.red,
                                  ),
                                );
                              });
                            },
                            child: Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ExpansionTile(
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
                                  style: const TextStyle(fontSize: 16),
                                ),
                                subtitle: Container(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isMusic
                                        ? Colors.blue.withOpacity(0.2)
                                        : Colors.red.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    isMusic ? 'Music' : 'YouTube',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: isMusic ? Colors.blue : Colors.red,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      padding: EdgeInsets.zero,
                                      constraints: BoxConstraints(
                                        minWidth: 28,
                                        minHeight: 28,
                                      ),
                                      visualDensity: VisualDensity.compact,
                                      icon: const Icon(
                                        Icons.skip_previous,
                                        size: 20,
                                        color: Colors.white,
                                      ),
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
                                    IconButton(
                                      padding: EdgeInsets.zero,
                                      constraints: BoxConstraints(
                                        minWidth: 28,
                                        minHeight: 28,
                                      ),
                                      visualDensity: VisualDensity.compact,
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
                                        final currentStatus = itemData['status']
                                            .toString()
                                            .toLowerCase();
                                        final newStatus =
                                            currentStatus.contains('play')
                                                ? 'pause'
                                                : 'play';
                                        try {
                                          await FirebaseDatabase.instance
                                              .ref()
                                              .child(isMusic
                                                  ? 'musicTracks'
                                                  : 'youtubeVideos')
                                              .child(item.key)
                                              .update({
                                            'status': newStatus,
                                            'timestamp': DateFormat(
                                                    'dd.MM.yyyy HH:mm:ss')
                                                .format(DateTime.now()),
                                          });
                                        } catch (e) {
                                          print('Status güncelleme hatası: $e');
                                        }
                                      },
                                    ),
                                    IconButton(
                                      padding: EdgeInsets.zero,
                                      constraints: BoxConstraints(
                                        minWidth: 28,
                                        minHeight: 28,
                                      ),
                                      visualDensity: VisualDensity.compact,
                                      icon: const Icon(
                                        Icons.skip_next,
                                        size: 20,
                                        color: Colors.white,
                                      ),
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
                                  ],
                                ),
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.all(16.0),
                                    child: Column(
                                      children: [
                                        // Zaman çubuğu
                                        Row(
                                          children: [
                                            Text(
                                              _formatDuration(
                                                  itemData['currentTime'] ?? 0),
                                              style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.white70),
                                            ),
                                            Expanded(
                                              child: SliderTheme(
                                                data: SliderTheme.of(context)
                                                    .copyWith(
                                                  trackHeight: 2.0,
                                                  activeTrackColor: isMusic
                                                      ? Colors.blue
                                                      : Colors.red,
                                                  inactiveTrackColor:
                                                      Colors.grey[800],
                                                  thumbColor: Colors.white,
                                                  overlayColor: (isMusic
                                                          ? Colors.blue
                                                          : Colors.red)
                                                      .withOpacity(0.2),
                                                  thumbShape:
                                                      RoundSliderThumbShape(
                                                    enabledThumbRadius: 6.0,
                                                    elevation: 2.0,
                                                  ),
                                                  overlayShape:
                                                      RoundSliderOverlayShape(
                                                    overlayRadius: 12.0,
                                                  ),
                                                ),
                                                child: Slider(
                                                  value: (itemData[
                                                              'currentTime'] ??
                                                          0)
                                                      .toDouble(),
                                                  min: 0,
                                                  max: (itemData['duration'] ??
                                                          0)
                                                      .toDouble(),
                                                  onChanged:
                                                      (double value) async {
                                                    try {
                                                      await FirebaseDatabase
                                                          .instance
                                                          .ref()
                                                          .child(isMusic
                                                              ? 'musicTracks'
                                                              : 'youtubeVideos')
                                                          .child(item.key)
                                                          .update({
                                                        'currentTime':
                                                            value.round(),
                                                      });
                                                    } catch (e) {
                                                      print(
                                                          'Video konumu güncelleme hatası: $e');
                                                    }
                                                  },
                                                ),
                                              ),
                                            ),
                                            Text(
                                              _formatDuration(
                                                  itemData['duration'] ?? 0),
                                              style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.white70),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        // Ses kontrolü
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.volume_up,
                                              size: 16,
                                              color: Colors.white,
                                            ),
                                            Expanded(
                                              child: SliderTheme(
                                                data: SliderTheme.of(context)
                                                    .copyWith(
                                                  trackHeight: 2.0,
                                                  activeTrackColor:
                                                      Colors.green,
                                                  inactiveTrackColor:
                                                      Colors.grey[800],
                                                  thumbColor: Colors.white,
                                                  overlayColor: Colors.green
                                                      .withOpacity(0.2),
                                                  thumbShape:
                                                      RoundSliderThumbShape(
                                                    enabledThumbRadius: 6.0,
                                                    elevation: 2.0,
                                                  ),
                                                  overlayShape:
                                                      RoundSliderOverlayShape(
                                                    overlayRadius: 12.0,
                                                  ),
                                                ),
                                                child: Slider(
                                                  value:
                                                      (itemData['volume'] ?? 50)
                                                          .toDouble(),
                                                  min: 0,
                                                  max: 100,
                                                  divisions: 100,
                                                  label:
                                                      '${(itemData['volume'] ?? 50).round()}%',
                                                  onChangeEnd:
                                                      (double value) async {
                                                    try {
                                                      await FirebaseDatabase
                                                          .instance
                                                          .ref()
                                                          .child(isMusic
                                                              ? 'musicTracks'
                                                              : 'youtubeVideos')
                                                          .child(item.key)
                                                          .update({
                                                        'volume': value.round(),
                                                      });
                                                    } catch (e) {
                                                      print(
                                                          'Ses seviyesi güncelleme hatası: $e');
                                                    }
                                                  },
                                                  onChanged: (double value) {},
                                                ),
                                              ),
                                            ),
                                            Text(
                                              '${(itemData['volume'] ?? 50).round()}%',
                                              style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.white70),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
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

  String _formatDuration(int seconds) {
    final duration = Duration(seconds: seconds);
    final minutes = duration.inMinutes;
    final remainingSeconds = duration.inSeconds - minutes * 60;
    return '$minutes:${remainingSeconds.toString().padLeft(2, '0')}';
  }
}
