import 'package:dio/dio';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class DioClient {
  final Dio _dio = Dio();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  DioClient() {
    _dio.options.baseUrl = 'http://localhost:5000/api/v1';
    _dio.options.connectTimeout = const Duration(seconds: 15);
    _dio.options.receiveTimeout = const Duration(seconds: 15);
    
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _secureStorage.read(key: 'access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            final refreshToken = await _secureStorage.read(key: 'refresh_token');
            if (refreshToken != null) {
              try {
                // Fetch a new access token
                final tokenResponse = await Dio().post(
                  '${_dio.options.baseUrl}/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );
                final newAccessToken = tokenResponse.data['data']['accessToken'];
                final newRefreshToken = tokenResponse.data['data']['refreshToken'];
                
                await _secureStorage.write(key: 'access_token', value: newAccessToken);
                await _secureStorage.write(key: 'refresh_token', value: newRefreshToken);

                // Clone and resubmit the failed request
                e.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                final response = await _dio.fetch(e.requestOptions);
                return handler.resolve(response);
              } catch (_) {
                await _secureStorage.delete(key: 'access_token');
                await _secureStorage.delete(key: 'refresh_token');
                // Send logout event or redirect to login
              }
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  Dio get instance => _dio;
}
