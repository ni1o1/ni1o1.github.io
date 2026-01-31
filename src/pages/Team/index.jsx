import React from 'react';
import { useTranslation } from 'react-i18next';

// Faculty collaborators
const facultyMembers = [
  {
    id: 'guo-zhiling',
    nameZh: '郭直灵',
    nameEn: 'Zhiling Guo',
    titleZh: '助理教授',
    titleEn: 'Assistant Professor',
    affiliationZh: '香港理工大学',
    affiliationEn: 'The Hong Kong Polytechnic University',
    avatar: '/images/team/guo-zhiling.jpg',
    homepage: null,
  },
  {
    id: 'yang-zhenyu',
    nameZh: '杨振宇',
    nameEn: 'Zhenyu Yang',
    titleZh: '助理教授',
    titleEn: 'Assistant Professor',
    affiliationZh: '岛根大学',
    affiliationEn: 'Shimane University',
    avatar: '/images/team/yang-zhenyu.jpg',
    homepage: null,
  },
  {
    id: 'zhang-zhe',
    nameZh: '张哲',
    nameEn: 'Zhe Zhang',
    titleZh: '博士后',
    titleEn: 'Postdoc',
    affiliationZh: '清华大学',
    affiliationEn: 'Tsinghua University',
    avatar: '/images/team/zhang-zhe.jpg',
    homepage: null,
  },
  {
    id: 'yuan-jian',
    nameZh: '袁见',
    nameEn: 'Jian Yuan',
    titleZh: '博士后',
    titleEn: 'Postdoc',
    affiliationZh: '北京大学',
    affiliationEn: 'Peking University',
    avatar: '/images/team/yuan-jian.jpg',
    homepage: null,
  },
];

// Student collaborators
const studentMembers = [
  {
    id: 'dong-kechuan',
    nameZh: '董克川',
    nameEn: 'Kechuan Dong',
    degreeZh: '硕士',
    degreeEn: 'M.S.',
    affiliationZh: '东京大学',
    affiliationEn: 'The University of Tokyo',
    avatar: '/images/team/dong-kechuan.jpg',
    homepage: null,
  },
  {
    id: 'xu-jian',
    nameZh: '徐剑',
    nameEn: 'Jian Xu',
    degreeZh: '硕士',
    degreeEn: 'M.S.',
    affiliationZh: '香港理工大学',
    affiliationEn: 'The Hong Kong Polytechnic University',
    avatar: '/images/team/xu-jian.jpg',
    homepage: null,
  },
  {
    id: 'liu-xuanyu',
    nameZh: '刘轩语',
    nameEn: 'Xuanyu Liu',
    degreeZh: '博士',
    degreeEn: 'Ph.D.',
    affiliationZh: '香港理工大学',
    affiliationEn: 'The Hong Kong Polytechnic University',
    avatar: '/images/team/liu-xuanyu.jpg',
    homepage: null,
  },
  {
    id: 'jiang-haoran',
    nameZh: '姜淏然',
    nameEn: 'Haoran Jiang',
    degreeZh: '博士',
    degreeEn: 'Ph.D.',
    affiliationZh: '同济大学',
    affiliationEn: 'Tongji University',
    avatar: '/images/team/jiang-haoran.jpg',
    homepage: null,
  },
  {
    id: 'xu-xuanyu',
    nameZh: '许炫宇',
    nameEn: 'Xuanyu Xu',
    degreeZh: '硕士',
    degreeEn: 'M.S.',
    affiliationZh: '香港大学',
    affiliationEn: 'The University of Hong Kong',
    avatar: '/images/team/xu-xuanyu.jpg',
    homepage: null,
  },
  {
    id: 'zhao-qijian',
    nameZh: '赵旗舰',
    nameEn: 'Qijian Zhao',
    degreeZh: '科研助理',
    degreeEn: 'Research Assistant',
    affiliationZh: '北京大学',
    affiliationEn: 'Peking University',
    avatar: '/images/team/zhao-qijian.jpg',
    homepage: null,
  },
  {
    id: 'li-jiaxing',
    nameZh: '李家兴',
    nameEn: 'Jiaxing Li',
    degreeZh: '科研助理',
    degreeEn: 'Research Assistant',
    affiliationZh: '北京大学',
    affiliationEn: 'Peking University',
    avatar: '/images/team/li-jiaxing.jpg',
    homepage: null,
  },
];

const contactEmail = 'yuq@pku.edu.cn';

// Partner labs data
const partnerLabs = [
  {
    id: 'pku-dccl',
    nameZh: '智慧城市实验室',
    nameEn: 'Data-driven Smart City Lab',
    affiliationZh: '北京大学',
    affiliationEn: 'Peking University',
    url: 'https://www.pkudccl.com',
    logo: '/images/team/pku-dccl.jpg',
  },
  {
    id: 'polyu-digienergy',
    nameZh: 'DigiEnergy Lab',
    nameEn: 'DigiEnergy Lab',
    affiliationZh: '香港理工大学',
    affiliationEn: 'The Hong Kong Polytechnic University',
    url: 'https://www.chokurei.net',
    logo: '/images/team/polyu-digienergy.jpg',
  },
];

function MemberCard({ member, language, showTitle = false, showDegree = false }) {
  const name = language === 'zh' ? member.nameZh : member.nameEn;
  const affiliation = language === 'zh' ? member.affiliationZh : member.affiliationEn;
  const title = member.titleZh ? (language === 'zh' ? member.titleZh : member.titleEn) : null;
  const degree = member.degreeZh ? (language === 'zh' ? member.degreeZh : member.degreeEn) : null;

  let subtitle = affiliation;
  if (showTitle && title) {
    subtitle = `${title}, ${affiliation}`;
  } else if (showDegree && degree) {
    subtitle = `${degree}, ${affiliation}`;
  }

  const CardContent = () => (
    <div className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
        <img
          src={member.avatar}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 text-lg font-medium">${member.nameZh.charAt(0)}</div>`;
          }}
        />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-slate-800 leading-tight">{name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );

  if (member.homepage) {
    return (
      <a
        href={member.homepage}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline block"
      >
        <CardContent />
      </a>
    );
  }

  return <CardContent />;
}

export default function TeamPage() {
  const { t, i18n } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        {i18n.language === 'zh' ? '团队' : 'Team'}
      </h1>
      <p className="text-gray-500 mb-8">
        {i18n.language === 'zh' ? '学术合作伙伴' : 'Academic Collaborators'}
      </p>

      {/* Faculty collaborators */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-slate-700 mb-4">
          {i18n.language === 'zh' ? '合作学者' : 'Scholar Collaborators'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
          {facultyMembers.map((member) => (
            <MemberCard key={member.id} member={member} language={i18n.language} showTitle />
          ))}
        </div>
      </div>

      {/* Student collaborators */}
      <div className="mb-12">
        <h2 className="text-lg font-medium text-slate-700 mb-4">
          {i18n.language === 'zh' ? '合作学生' : 'Student Collaborators'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
          {studentMembers.map((member) => (
            <MemberCard key={member.id} member={member} language={i18n.language} showDegree />
          ))}
        </div>
      </div>

      {/* Partner Labs */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">
          {i18n.language === 'zh' ? '合作团队' : 'Partner Labs'}
        </h2>
        <div className="space-y-2">
          {partnerLabs.map((lab) => (
            <a
              key={lab.id}
              href={lab.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors no-underline"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {lab.logo ? (
                  <img src={lab.logo} alt={lab.nameEn} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-slate-800 leading-tight">
                  {i18n.language === 'zh' ? lab.nameZh : lab.nameEn}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {i18n.language === 'zh' ? lab.affiliationZh : lab.affiliationEn}
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      {/* Join us section */}
      <div className="border-t border-gray-200 pt-10">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">
          {i18n.language === 'zh' ? '加入我们' : 'Join Us'}
        </h2>
        <p className="text-gray-600 leading-relaxed mb-6">
          {i18n.language === 'zh'
            ? '如果你对我们团队感兴趣，欢迎加入！'
            : 'If you are interested in our team, welcome to join us!'}
        </p>
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors no-underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {contactEmail}
        </a>
      </div>
    </div>
  );
}
