import React, { useState, useMemo } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Card, 
  Input, 
  Select, 
  DatePicker, 
  message, 
  Tooltip,
  Modal
} from 'antd';
import { 
  SearchOutlined, 
  DownloadOutlined, 
  EyeOutlined 
} from '@ant-design/icons';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface Transaction {
  id: string; // #ORD-8921
  dateTime: string;
  tableNo: string;
  totalAmount: number;
  paymentMethod: string;
  status: 'Completed' | 'Cancelled' | 'Refunded';
}

const TransactionsPage: React.FC = () => {
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Initial mock data matching the screenshot exactly!
  const transactions: Transaction[] = [
    {
      id: '#ORD-8921',
      dateTime: 'Oct 24, 2023 • 19:45',
      tableNo: 'T-12',
      totalAmount: 145.50,
      paymentMethod: 'Credit Card',
      status: 'Completed'
    },
    {
      id: '#ORD-8920',
      dateTime: 'Oct 24, 2023 • 19:30',
      tableNo: 'T-04',
      totalAmount: 82.00,
      paymentMethod: 'QR Pay',
      status: 'Completed'
    },
    {
      id: '#ORD-8919',
      dateTime: 'Oct 24, 2023 • 19:15',
      tableNo: 'Bar-02',
      totalAmount: 34.00,
      paymentMethod: 'Cash',
      status: 'Cancelled'
    },
    {
      id: '#ORD-8918',
      dateTime: 'Oct 24, 2023 • 18:50',
      tableNo: 'T-08',
      totalAmount: 210.75,
      paymentMethod: 'Credit Card',
      status: 'Refunded'
    },
    {
      id: '#ORD-8917',
      dateTime: 'Oct 24, 2023 • 18:30',
      tableNo: 'T-15',
      totalAmount: 95.20,
      paymentMethod: 'QR Pay',
      status: 'Completed'
    }
  ];

  // Search & Filter
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = 
        t.id.toLowerCase().includes(searchText.toLowerCase()) ||
        t.tableNo.toLowerCase().includes(searchText.toLowerCase()) ||
        t.paymentMethod.toLowerCase().includes(searchText.toLowerCase());

      const matchesStatus = 
        statusFilter === 'ALL' || 
        t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchText, statusFilter]);

  // Export handler
  const handleExportData = () => {
    message.success('Đang kết xuất dữ liệu lịch sử giao dịch dưới dạng CSV...');
  };

  // View details modal
  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  // Columns Configuration
  const columns = [
    {
      title: 'ORDER ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: Transaction) => (
        <a 
          style={{ fontWeight: 600, color: '#1890ff' }} 
          onClick={() => handleViewDetails(record)}
        >
          {id}
        </a>
      ),
    },
    {
      title: 'DATE & TIME',
      dataIndex: 'dateTime',
      key: 'dateTime',
      render: (dateTime: string) => <span style={{ color: '#4a5568' }}>{dateTime}</span>,
    },
    {
      title: 'TABLE NO',
      dataIndex: 'tableNo',
      key: 'tableNo',
      render: (tableNo: string) => <span style={{ fontWeight: 500, color: '#2d3748' }}>{tableNo}</span>,
    },
    {
      title: 'TOTAL AMOUNT',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => (
        <span style={{ fontWeight: 600, color: '#1a202c' }}>
          ${amount.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'PAYMENT METHOD',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method: string) => <span style={{ color: '#4a5568' }}>{method}</span>,
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let bgColor = '#f6ffed';
        let textColor = '#52c41a';

        if (status === 'Cancelled') {
          bgColor = '#fff1f0';
          textColor = '#f5222d';
        } else if (status === 'Refunded') {
          bgColor = '#fafafa';
          textColor = '#8c8c8c';
        }

        return (
          <Tag 
            style={{ 
              borderRadius: 6, 
              padding: '2px 12px', 
              fontWeight: 500,
              backgroundColor: bgColor,
              color: textColor,
              border: 'none'
            }}
          >
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'ACTION',
      key: 'action',
      render: (_: any, record: Transaction) => (
        <Tooltip title="Xem chi tiết hóa đơn">
          <Button 
            type="text" 
            icon={<EyeOutlined style={{ color: '#4a5568' }} />} 
            onClick={() => handleViewDetails(record)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="transactions-container">
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a202c' }}>Order & Transaction History</h2>
        <p style={{ margin: 0, color: '#718096', fontSize: '14px' }}>View past orders and manage receipts.</p>
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
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
            <div style={{ minWidth: 200 }}>
              <span style={{ display: 'block', fontSize: '12px', color: '#718096', marginBottom: 4, fontWeight: 500 }}>Search Order ID</span>
              <Input
                placeholder="e.g. #ORD-1234"
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ borderRadius: 6, height: 38 }}
              />
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '12px', color: '#718096', marginBottom: 4, fontWeight: 500 }}>Date Range</span>
              <RangePicker style={{ height: 38, borderRadius: 6 }} />
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '12px', color: '#718096', marginBottom: 4, fontWeight: 500 }}>Status</span>
              <Select
                defaultValue="ALL"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                style={{ width: 140, height: 38 }}
              >
                <Option value="ALL">All Statuses</Option>
                <Option value="Completed">Completed</Option>
                <Option value="Cancelled">Cancelled</Option>
                <Option value="Refunded">Refunded</Option>
              </Select>
            </div>
          </div>

          <Button 
            icon={<DownloadOutlined />}
            onClick={handleExportData}
            style={{ 
              borderRadius: 6, 
              height: 38,
              fontWeight: 500,
              alignSelf: 'flex-end',
              marginBottom: 0
            }}
          >
            Export Data
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)'
        }}
      >
        <Table 
          columns={columns} 
          dataSource={filteredTransactions} 
          rowKey="id"
          pagination={{
            pageSize: 5,
            showTotal: (total, range) => `Showing ${range[0]} to ${range[1]} of ${total} entries`
          }}
        />
      </Card>

      {/* Details Modal */}
      <Modal
        title={`Chi tiết giao dịch ${selectedTransaction?.id}`}
        open={selectedTransaction !== null}
        onCancel={() => setSelectedTransaction(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedTransaction(null)}>Đóng</Button>,
          <Button key="print" type="primary" onClick={() => message.success('Đang in hóa đơn hóa đơn...')}>In hóa đơn</Button>
        ]}
      >
        {selectedTransaction && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#718096' }}>Thời gian:</span>
              <span style={{ fontWeight: 500 }}>{selectedTransaction.dateTime}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#718096' }}>Bàn phục vụ:</span>
              <span style={{ fontWeight: 500 }}>{selectedTransaction.tableNo}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#718096' }}>Phương thức thanh toán:</span>
              <span style={{ fontWeight: 500 }}>{selectedTransaction.paymentMethod}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#718096' }}>Trạng thái:</span>
              <span style={{ fontWeight: 500 }}>{selectedTransaction.status}</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 600 }}>
              <span>TỔNG THANH TOÁN:</span>
              <span style={{ color: '#1890ff' }}>${selectedTransaction.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;
