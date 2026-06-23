import 'package:flutter/material';
import 'package:flutter_riverpod/flutter_riverpod';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';

void main() {
  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenUtilInit(
      designSize: const Size(375, 812), // iPhone X/11 standard
      minTextAdapt: true,
      splitScreenMode: true,
      builder: (context, child) {
        return MaterialApp.router(
          title: 'SmartDine Customer App',
          theme: ThemeData(
            primarySwatch: Colors.emerald,
            useMaterial3: true,
          ),
          routerConfig: _router,
        );
      },
    );
  }
}

// Simple declarative routing mapping screen transitions
final GoRouter _router = GoRouter(
  routes: <RouteBase>[
    GoRoute(
      path: '/',
      builder: (BuildContext context, GoRouterState state) {
        return const HomeScreen();
      },
      routes: <RouteBase>[
        GoRoute(
          path: 'menu',
          builder: (BuildContext context, GoRouterState state) {
            return const MenuScreen();
          },
        ),
      ],
    ),
  ],
);

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SmartDine Customer App'),
        backgroundColor: Colors.emerald,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.restaurant_menu, size: 80.r, color: Colors.emerald),
            SizedBox(height: 16.h),
            Text(
              'Chào mừng tới SmartDine!',
              style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 24.h),
            ElevatedButton(
              onPressed: () => context.go('/menu'),
              child: const Text('Xem Thực Đơn'),
            ),
          ],
        ),
      ),
    );
  }
}

class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thực Đơn'),
        backgroundColor: Colors.emerald,
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: EdgeInsets.all(16.r),
        children: [
          _buildItem(context, 'Gỏi Cuốn Tôm Thịt', '35,000đ'),
          _buildItem(context, 'Cơm Chiên Hải Sản', '85,000đ'),
          _buildItem(context, 'Bò Lúc Lắc', '150,000đ'),
          _buildItem(context, 'Phở Bò Kobe', '250,000đ'),
        ],
      ),
    );
  }

  Widget _buildItem(BuildContext context, String name, String price) {
    return Card(
      margin: EdgeInsets.symmetric(vertical: 8.h),
      child: ListTile(
        leading: const Icon(Icons.fastfood, color: Colors.amber),
        title: Text(name, style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w600)),
        subtitle: Text(price, style: TextStyle(color: Colors.emerald, fontSize: 14.sp)),
        trailing: IconButton(
          icon: const Icon(Icons.add_shopping_cart, color: Colors.emerald),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Đã thêm $name vào giỏ hàng!')),
            );
          },
        ),
      ),
    );
  }
}
