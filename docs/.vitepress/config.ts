import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'คู่มือการใช้งาน',
  description: 'คู่มือการใช้งานระบบประเมินและสนับสนุนพนักงานขาย (Sales Evaluation & Enablement)',
  lang: 'th-TH',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    siteTitle: 'คู่มือ Sales Evaluation',

    nav: [
      { text: 'เริ่มต้นใช้งาน', link: '/getting-started/overview' },
      { text: 'ฉันต้องการ...', link: '/' },
      { text: 'คู่มือแต่ละเมนู', link: '/features/dashboard' },
      { text: 'สิทธิ์การใช้งาน', link: '/roles/' },
      { text: 'FAQ', link: '/faq/' },
      { text: 'แก้ไขปัญหา', link: '/troubleshooting/' },
    ],

    sidebar: [
      {
        text: 'เริ่มต้นใช้งาน',
        collapsed: false,
        items: [
          { text: 'ระบบนี้คืออะไร', link: '/getting-started/overview' },
          { text: 'การเข้าสู่ระบบ', link: '/getting-started/login' },
          { text: 'เริ่มต้นใช้งานอย่างรวดเร็ว', link: '/getting-started/quick-start' },
        ],
      },
      {
        text: 'สิทธิ์การใช้งาน',
        items: [{ text: 'บทบาทและสิทธิ์', link: '/roles/' }],
      },
      {
        text: 'งานที่ทำบ่อย',
        collapsed: false,
        items: [
          { text: 'นำเข้าข้อมูลการขายรายเดือน', link: '/tasks/import-monthly-sales' },
          { text: 'ตั้ง/แก้เป้าให้พนักงานขาย', link: '/tasks/set-targets' },
          { text: 'ยืนยันชื่อที่ซ้ำกัน', link: '/tasks/resolve-name-duplicates' },
          { text: 'จัดการเขตและ supervisor', link: '/tasks/manage-territories' },
          { text: 'สั่งสร้างคำแนะนำ AI', link: '/tasks/generate-ai-coaching' },
          { text: 'ดูผลงานของตัวเอง', link: '/tasks/view-my-performance' },
          { text: 'Export รายงาน', link: '/tasks/export-reports' },
        ],
      },
      {
        text: 'คู่มือแต่ละเมนู',
        collapsed: false,
        items: [
          { text: 'ภาพรวม (Dashboard)', link: '/features/dashboard' },
          { text: 'ผลงาน / Leaderboard / ภาพรวมทีม', link: '/features/performance-leaderboard-team-overview' },
          { text: 'เป้าหมาย', link: '/features/targets-and-target-assist' },
          { text: 'พื้นที่และลูกค้า', link: '/features/territories-and-hospitals' },
          { text: 'ข้อมูลการขาย', link: '/features/sales-data-and-master-data' },
          { text: 'ตั้งค่า', link: '/features/settings-and-users' },
        ],
      },
      {
        text: 'Workflow',
        collapsed: true,
        items: [
          { text: 'รอบนำเข้าข้อมูลประจำเดือน', link: '/workflows/monthly-import-cycle' },
          { text: 'การแทนที่/ลบข้อมูลตามงวด', link: '/workflows/period-replace-and-delete' },
        ],
      },
      {
        text: 'อื่น ๆ',
        collapsed: true,
        items: [
          { text: 'คำถามที่พบบ่อย', link: '/faq/' },
          { text: 'แก้ไขปัญหา', link: '/troubleshooting/' },
        ],
      },
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: 'ค้นหา', buttonAriaLabel: 'ค้นหา' },
              modal: {
                displayDetails: 'แสดงรายละเอียด',
                resetButtonTitle: 'ล้างการค้นหา',
                noResultsText: 'ไม่พบผลลัพธ์สำหรับ',
                footer: { selectText: 'เลือก', navigateText: 'เปลี่ยน', closeText: 'ปิด' },
              },
            },
          },
        },
      },
    },

    outline: {
      label: 'สารบัญในหน้านี้',
    },

    docFooter: {
      prev: 'ก่อนหน้า',
      next: 'ถัดไป',
    },

    returnToTopLabel: 'กลับขึ้นด้านบน',
    darkModeSwitchLabel: 'ธีม',
    sidebarMenuLabel: 'เมนู',
  },
})
