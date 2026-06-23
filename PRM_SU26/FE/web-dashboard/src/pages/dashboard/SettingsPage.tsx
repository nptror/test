import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Tabs, 
  Form, 
  Input, 
  Select, 
  Button, 
  message, 
  Row, 
  Col,
  Typography
} from 'antd';

const { Option } = Select;
const { Title } = Typography;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState<string>('general');

  // Load settings from localStorage or fallback to defaults matching mockup!
  useEffect(() => {
    const savedName = localStorage.getItem('smartdine_restaurant_name') || 'SmartDine Elite';
    const savedContact = localStorage.getItem('smartdine_restaurant_contact') || '+1 (555) 123-4567';
    const savedAddress = localStorage.getItem('smartdine_restaurant_address') || '123 Tech Boulevard, Innovation District';
    const savedCurrency = localStorage.getItem('smartdine_restaurant_currency') || 'USD';
    const savedTimezone = localStorage.getItem('smartdine_restaurant_timezone') || 'PT';

    form.setFieldsValue({
      restaurantName: savedName,
      contactNumber: savedContact,
      primaryAddress: savedAddress,
      primaryCurrency: savedCurrency,
      timezone: savedTimezone
    });
  }, [form]);

  // Save changes handler
  const handleSaveChanges = (values: any) => {
    localStorage.setItem('smartdine_restaurant_name', values.restaurantName);
    localStorage.setItem('smartdine_restaurant_contact', values.contactNumber);
    localStorage.setItem('smartdine_restaurant_address', values.primaryAddress);
    localStorage.setItem('smartdine_restaurant_currency', values.primaryCurrency);
    localStorage.setItem('smartdine_restaurant_timezone', values.timezone);

    message.success('Đã lưu các thay đổi cấu hình hệ thống!');
  };

  // Reset form to defaults
  const handleReset = () => {
    form.setFieldsValue({
      restaurantName: 'SmartDine Elite',
      contactNumber: '+1 (555) 123-4567',
      primaryAddress: '123 Tech Boulevard, Innovation District',
      primaryCurrency: 'USD',
      timezone: 'PT'
    });
    message.info('Đã khôi phục về cấu hình mặc định.');
  };

  const tabItems = [
    {
      key: 'general',
      label: 'General Info',
      children: (
        <Card 
          title={<span style={{ fontSize: '18px', fontWeight: 600 }}>Restaurant Details</span>}
          bordered={false}
          style={{ borderRadius: 8 }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveChanges}
            requiredMark={false}
          >
            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="restaurantName"
                  label={<span style={{ fontWeight: 500, color: '#4a5568' }}>Restaurant Name</span>}
                  rules={[{ required: true, message: 'Please enter restaurant name' }]}
                >
                  <Input style={{ height: 38, borderRadius: 6 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="contactNumber"
                  label={<span style={{ fontWeight: 500, color: '#4a5568' }}>Contact Number</span>}
                  rules={[{ required: true, message: 'Please enter contact number' }]}
                >
                  <Input style={{ height: 38, borderRadius: 6 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="primaryAddress"
              label={<span style={{ fontWeight: 500, color: '#4a5568' }}>Primary Address</span>}
              rules={[{ required: true, message: 'Please enter primary address' }]}
            >
              <Input style={{ height: 38, borderRadius: 6 }} />
            </Form.Item>

            <Row gutter={24}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="primaryCurrency"
                  label={<span style={{ fontWeight: 500, color: '#4a5568' }}>Primary Currency</span>}
                  rules={[{ required: true }]}
                >
                  <Select style={{ height: 38 }}>
                    <Option value="USD">USD - US Dollar</Option>
                    <Option value="VND">VND - Vietnamese Dong</Option>
                    <Option value="EUR">EUR - Euro</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="timezone"
                  label={<span style={{ fontWeight: 500, color: '#4a5568' }}>Timezone</span>}
                  rules={[{ required: true }]}
                >
                  <Select style={{ height: 38 }}>
                    <Option value="PT">Pacific Time (PT)</Option>
                    <Option value="ICT">Indochina Time (ICT - Hanoi/Bangkok)</Option>
                    <Option value="EST">Eastern Standard Time (EST)</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button 
                onClick={handleReset}
                style={{ 
                  borderRadius: 6, 
                  height: 38, 
                  padding: '0 20px',
                  fontWeight: 500
                }}
              >
                Reset
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                style={{ 
                  borderRadius: 6, 
                  height: 38, 
                  padding: '0 20px',
                  fontWeight: 500,
                  backgroundColor: '#1890ff'
                }}
              >
                Save Changes
              </Button>
            </div>
          </Form>
        </Card>
      )
    },
    {
      key: 'config',
      label: 'System Config',
      children: (
        <Card bordered={false} style={{ borderRadius: 8 }}>
          <Title level={4}>Cấu hình thiết bị & hệ thống</Title>
          <p style={{ color: '#718096' }}>Quản lý máy in hóa đơn, tích hợp POS và phân giải mã QR quét bàn tại đây.</p>
        </Card>
      )
    },
    {
      key: 'account',
      label: 'My Account',
      children: (
        <Card bordered={false} style={{ borderRadius: 8 }}>
          <Title level={4}>Tài khoản cá nhân</Title>
          <p style={{ color: '#718096' }}>Thay đổi mật khẩu đăng nhập, khóa bảo mật 2 lớp và cập nhật thông tin cá nhân của bạn.</p>
        </Card>
      )
    }
  ];

  return (
    <div className="system-settings-container">
      {/* Page Title */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a202c' }}>System Settings</h2>
      </div>

      {/* Tabs */}
      <Tabs 
        activeKey={activeTab} 
        onChange={(key) => setActiveTab(key)}
        items={tabItems}
        style={{ marginBottom: 24 }}
      />
    </div>
  );
};

export default SettingsPage;
