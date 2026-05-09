export default defineAppConfig({
  pages: [
    'pages/practice/index',
    'pages/question-bank/index',
    'pages/videos/index',
    'pages/profile/index',
    'pages/activate/index',
    'pages/question-detail/index',
    'pages/question-bank-module/index',
  ],
  tabBar: {
    color: '#627577',
    selectedColor: '#138b8f',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/practice/index', text: '练习' },
      { pagePath: 'pages/question-bank/index', text: '题库' },
      { pagePath: 'pages/videos/index', text: '视频' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7fbfb',
    navigationBarTitleText: '医护自学辅助',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f7fbfb',
  },
})
