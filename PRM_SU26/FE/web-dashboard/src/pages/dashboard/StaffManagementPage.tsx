import React, { useState, useMemo } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Card, 
  Input, 
  Select, 
  Modal, 
  Form, 
  message, 
  Tooltip,
  Avatar
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ReloadOutlined 
} from '@ant-design/icons';

const { Option } = Select;

interface StaffMember {
  id: string; // S-101
  fullName: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Chef' | 'Staff';
  isActive: boolean;
}

const StaffManagementPage: React.FC = () => {
  const [searchText, setSearchText] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Initial staff list matching screenshot exactly!
  const [staffList, setStaffList] = useState<StaffMember[]>([
    {
      id: 'S-101',
      fullName: 'Alice Smith',
      email: 'alice.s@smartdine.com',
      phone: '+1 (555) 019-2831',
      role: 'Admin',
      isActive: true
    },
    {
      id: 'S-102',
      fullName: 'Robert Johnson',
      email: 'robert.j@smartdine.com',
      phone: '+1 (555) 837-1920',
      role: 'Chef',
      isActive: true
    },
    {
      id: 'S-103',
      fullName: 'Maria Garcia',
      email: 'maria.g@smartdine.com',
      phone: '+1 (555) 231-9045',
      role: 'Staff',
      isActive: true
    },
    {
      id: 'S-104',
      fullName: 'David Lee',
      email: 'david.l@smartdine.com',
      phone: '+1 (555) 765-4321',
      role: 'Staff',
      isActive: false
    },
    {
      id: 'S-105',
      fullName: 'Sarah Williams',
      email: 'sarah.w@smartdine.com',
      phone: '+1 (555) 112-2334',
      role: 'Staff',
      isActive: true
    },
    {
      id: 'S-106',
      fullName: 'Michael Brown',
      email: 'michael.b@smartdine.com',
      phone: '+1 (555) 998-8776',
      role: 'Chef',
      isActive: true
    }
  ]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Search & Filter
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch = 
        s.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
        s.email.toLowerCase().includes(searchText.toLowerCase()) ||
        s.phone.includes(searchText) ||
        s.id.toLowerCase().includes(searchText.toLowerCase());

      const matchesRole = 
        roleFilter === 'ALL' || 
        s.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [staffList, searchText, roleFilter]);

  // Add staff member
  const handleAddStaff = (values: any) => {
    const nextNum = staffList.length > 0 
      ? Math.max(...staffList.map((s) => parseInt(s.id.split('-')[1]))) + 1 
      : 101;
      
    const newStaff: StaffMember = {
      id: `S-${nextNum}`,
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      role: values.role,
      isActive: true
    };

    setStaffList((prev) => [...prev, newStaff]);
    setIsAddModalOpen(false);
    addForm.resetFields();
    message.success(`Đã thêm thành viên ${values.fullName} thành công!`);
  };

  // Edit staff member
  const handleEditStaff = (values: any) => {
    if (!selectedStaff) return;

    setStaffList((prev) => prev.map((s) => s.id === selectedStaff.id ? {
      ...s,
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      role: values.role,
      isActive: values.isActive
    } : s));

    setIsEditModalOpen(false);
    setSelectedStaff(null);
    message.success('Cập nhật thông tin nhân viên thành công!');
  };

  // Reset password
  const handleResetPassword = (name: string) => {
    message.success(`Đã đặt lại mật khẩu và gửi email khôi phục cho ${name}!`);
  };

  // Delete staff member
  const handleDeleteStaff = (id: string, name: string) => {
    Modal.confirm({
      title: 'Xóa nhân viên',
      content: `Bạn chắc chắn muốn xóa nhân viên ${name} (${id})?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => {
        setStaffList((prev) => prev.filter((s) => s.id !== id));
        message.success('Đã xóa nhân viên thành công!');
      }
    });
  };

  // Get Initials for Avatar
  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Columns Configuration
  const columns = [
    {
      title: 'STAFF ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span style={{ fontWeight: 600, color: '#4a5568' }}>{id}</span>,
    },
    {
      title: 'FULL NAME',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (fullName: string) => {
        const initials = getInitials(fullName);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar 
              style={{ 
                backgroundColor: '#e6f7ff', 
                color: '#1890ff', 
                fontWeight: 600,
                border: '1px solid #1890ff'
              }}
            >
              {initials}
            </Avatar>
            <span style={{ fontWeight: 500, color: '#1a202c' }}>{fullName}</span>
          </div>
        );
      },
    },
    {
      title: 'CONTACT',
      key: 'contact',
      render: (_: any, record: StaffMember) => (
        <div>
          <div style={{ color: '#4a5568', fontSize: '13px' }}>{record.email}</div>
          <div style={{ color: '#a0aec0', fontSize: '12px' }}>{record.phone}</div>
        </div>
      ),
    },
    {
      title: 'ROLE',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        let color = '#e6f7ff';
        let textColor = '#1890ff';
        if (role === 'Chef') {
          color = '#fff7e6';
          textColor = '#fa8c16';
        } else if (role === 'Admin') {
          color = '#f0f5ff';
          textColor = '#2f54eb';
        }
        return (
          <Tag 
            style={{ 
              borderRadius: 12, 
              padding: '2px 12px', 
              fontWeight: 500,
              backgroundColor: color,
              color: textColor,
              border: 'none'
            }}
          >
            {role}
          </Tag>
        );
      },
    },
    {
      title: 'STATUS',
      dataIndex: 'isActive',
      key: 'status',
      render: (isActive: boolean) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span 
            style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: isActive ? '#1890ff' : '#bfbfbf',
              display: 'inline-block'
            }} 
          />
          <span style={{ color: isActive ? '#1890ff' : '#718096', fontSize: '13px', fontWeight: 500 }}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      render: (_: any, record: StaffMember) => (
        <Space size="middle">
          <Tooltip title="Chỉnh sửa nhân viên">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#4a5568' }} />} 
              onClick={() => {
                setSelectedStaff(record);
                editForm.setFieldsValue(record);
                setIsEditModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Reset mật khẩu">
            <Button 
              type="text" 
              icon={<ReloadOutlined style={{ color: '#4a5568' }} />} 
              onClick={() => handleResetPassword(record.fullName)}
            />
          </Tooltip>
          <Tooltip title="Xóa nhân viên">
            <Button 
              type="text" 
              danger
              icon={<DeleteOutlined />} 
              onClick={() => handleDeleteStaff(record.id, record.fullName)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="staff-management-container">
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a202c' }}>Staff Management</h2>
          <p style={{ margin: 0, color: '#718096', fontSize: '14px' }}>Manage employee access, roles, and details.</p>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setIsAddModalOpen(true)}
          style={{ 
            backgroundColor: '#1890ff', 
            borderRadius: 6, 
            height: 38,
            fontWeight: 500
          }}
        >
          Add Staff Member
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card 
        bordered={false}
        style={{
          borderRadius: 8,
          marginBottom: 20,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search staff by name, email, phone..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ borderRadius: 6, height: 38, maxWidth: 400 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#718096', fontWeight: 500, fontSize: '13px' }}>Role:</span>
            <Select
              defaultValue="ALL"
              value={roleFilter}
              onChange={(val) => setRoleFilter(val)}
              style={{ width: 150, height: 38 }}
            >
              <Option value="ALL">All Roles</Option>
              <Option value="Admin">Admin</Option>
              <Option value="Chef">Chef</Option>
              <Option value="Staff">Staff</Option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Staff Table */}
      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)'
        }}
      >
        <Table 
          columns={columns} 
          dataSource={filteredStaff} 
          rowKey="id"
          pagination={{
            pageSize: 6,
            showTotal: (total, range) => `Showing ${range[0]} to ${range[1]} of ${total} results`
          }}
        />
      </Card>

      {/* Modal: Add Staff Member */}
      <Modal
        title="Thêm Nhân Viên Mới"
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddStaff}
          initialValues={{ role: 'Staff' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="fullName"
            label="Họ và Tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên nhân viên!' }]}
          >
            <Input placeholder="Ví dụ: Alice Smith" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email liên hệ"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Vui lòng nhập đúng định dạng email!' }
            ]}
          >
            <Input placeholder="Ví dụ: alice.s@smartdine.com" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại!' }]}
          >
            <Input placeholder="Ví dụ: +1 (555) 019-2831" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai trò / Vị trí"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="Admin">Admin (Quản trị viên)</Option>
              <Option value="Chef">Chef (Đầu bếp)</Option>
              <Option value="Staff">Staff (Nhân viên phục vụ)</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsAddModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">Lưu lại</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Edit Staff Member */}
      <Modal
        title="Chỉnh Sửa Thông Tin Nhân Viên"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditStaff}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="fullName"
            label="Họ và Tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên nhân viên!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email liên hệ"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Vui lòng nhập đúng định dạng email!' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai trò"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="Admin">Admin</Option>
              <Option value="Chef">Chef</Option>
              <Option value="Staff">Staff</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Trạng thái hoạt động"
            valuePropName="checked"
          >
            <Select>
              <Option value={true}>Active (Đang làm việc)</Option>
              <Option value={false}>Inactive (Nghỉ việc/Khóa)</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsEditModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">Cập nhật</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StaffManagementPage;
