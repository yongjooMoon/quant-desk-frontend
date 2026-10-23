// src/pages/Account.jsx - route /account for non-admin users: the "my account" popup over a quiet page (the admin's account tab is /admin, where the same popup opens from a button)
import { useNavigate } from 'react-router-dom';
import { Card } from '../components';
import AccountModal from './AccountModal';

export default function Account() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 min-w-0">
      <h2 className="text-[20px] font-semibold text-slate-900 dark:text-white">내 계정</h2>
      <Card className="text-[13.5px] text-slate-500">이름·전화번호와 비밀번호를 수정할 수 있습니다.</Card>
      <AccountModal open onClose={() => navigate('/news')} />
    </div>
  );
}
