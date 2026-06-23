import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SocketService {
  io.Socket? _socket;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  void connect() async {
    final token = await _secureStorage.read(key: 'access_token');
    if (token == null) return;

    _socket = io.io(
      'http://localhost:5000',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(2000)
          .build(),
    );

    _socket?.onConnect((_) => print('Socket.io connected successfully'));
    _socket?.onDisconnect((_) => print('Socket.io disconnected'));
  }

  void subscribeToEvent(String eventName, Function(dynamic) callback) {
    _socket?.on(eventName, callback);
  }

  void unsubscribeFromEvent(String eventName) {
    _socket?.off(eventName);
  }

  void emit(String eventName, dynamic data) {
    _socket?.emit(eventName, data);
  }

  void disconnect() {
    _socket?.disconnect();
  }
}
