import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Alert, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/store';
import { loginUser, selectAuthLoading, selectAuthError, selectIsAuthenticated } from '@/store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css'; // Import tệp styles riêng biệt

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // If already authenticated, redirect to home page
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values: any) => {
    try {
      const result = await dispatch(loginUser({ email: values.email, password: values.password })).unwrap();
      if (result.user) {
        message.success(`Chào mừng trở lại, ${result.user.fullName}!`);
        navigate('/');
      }
    } catch (err: any) {
      // Error message is handled by redux and displayed in Alert
    }
  };

  return (
    <div className="login-container">
      {/* Decorative background gradients */}
      <div className="login-bg-orange" />
      <div className="login-bg-blue" />

      <Card
        className="login-card"
        bodyStyle={{ padding: 0 }} // We control padding in LoginPage.css to avoid antd overrides
      >
        <div className="login-card-body">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="login-logo-circle">
              SD
            </div>
            <Title level={2} style={{ margin: 0, color: '#fff', fontWeight: 700, letterSpacing: '-0.5px' }}>
              SmartDine
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: 14 }}>
              Hệ thống Quản lý Nhà hàng Thông minh
            </Text>
          </div>

          {error && (
            <Alert
              message="Đăng nhập thất bại"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 24, borderRadius: 8 }}
            />
          )}

          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập tên đăng nhập hoặc Email!' },
              ]}
            >
              <Input
                className="login-input"
                prefix={<UserOutlined style={{ color: 'rgba(255, 255, 255, 0.35)' }} />}
                placeholder="Tên đăng nhập hoặc Email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              style={{ marginBottom: 32 }}
            >
              <Input.Password
                className="login-input"
                prefix={<LockOutlined style={{ color: 'rgba(255, 255, 255, 0.35)' }} />}
                placeholder="Mật khẩu"
              />
            </Form.Item>

            <Form.Item style={{ margin: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-btn-submit"
              >
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
