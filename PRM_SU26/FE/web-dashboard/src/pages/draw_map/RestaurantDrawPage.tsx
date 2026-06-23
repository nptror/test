// src/pages/draw_map/RestaurantDrawPage.tsx
import React from "react";
import { Layout } from "antd";

import { Toolbar } from "@/components/components_draw_map/Toolbar";
import { MapCanvas } from "@/components/components_draw_map/MapCanvas";
import { PropertyPanel } from "@/components/components_draw_map/PropertyPanel";
import "@/styles/mapDesigner.css";

const { Content, Sider } = Layout;

const RestaurantDrawPage: React.FC = () => {
  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <Toolbar />

      <Layout>
        <Content
          style={{
            flex: 1,
            position: "relative",
            background: "#fafafa",
            overflow: "hidden",
          }}
        >
          <MapCanvas />
        </Content>

        <Sider
          width={320}
          theme="light"
          style={{
            borderLeft: "1px solid #e5e7eb",
            background: "#f5f5f5",
          }}
        >
          <PropertyPanel />
        </Sider>
      </Layout>
    </Layout>
  );
};

// ✅ Thêm dòng này
export default RestaurantDrawPage;