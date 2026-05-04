import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import type { BillingResponse } from '../../types';

/**
 * 用量统计卡片
 */
interface UsageCardProps {
  title: string;
  value: string | number;
  unit?: string;
  color: string;
}

function UsageCard({ title, value, unit, color }: UsageCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <div className="flex items-baseline">
        <span className={`text-3xl font-bold ${color}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="ml-2 text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}

/**
 * 用量计费页面
 */
export function Billing() {
  const { user } = useAuthStore();
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBilling();
  }, []);

  const loadBilling = async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const data = await apiClient.getBilling(user.tenantId);
      setBilling(data);
    } catch (err) {
      console.error('Failed to load billing:', err);
      setError(err instanceof Error ? err.message : '加载计费信息失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">暂无计费数据</p>
        </div>
      </div>
    );
  }

  const { database, realtime } = billing;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">用量计费</h2>
        <p className="text-sm text-gray-600 mt-1">
          租户 {user?.tenantId} 的 Token 使用和费用统计
        </p>
      </div>

      {/* 数据库统计 */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">数据库统计（历史累计）</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <UsageCard
            title="输入 Token"
            value={database.totalInputTokens || 0}
            unit="tokens"
            color="text-blue-600"
          />
          <UsageCard
            title="输出 Token"
            value={database.totalOutputTokens || 0}
            unit="tokens"
            color="text-green-600"
          />
          <UsageCard
            title="总费用"
            value={`$${(database.totalCostUSD || 0).toFixed(4)}`}
            color="text-purple-600"
          />
          <UsageCard
            title="记录数"
            value={database.recordCount || 0}
            unit="条"
            color="text-gray-600"
          />
        </div>
      </div>

      {/* 实时统计 */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">实时统计（当前会话）</h3>
        {Object.keys(realtime).length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    指标
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    值
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(realtime).map(([key, value]) => (
                  <tr key={key}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {key}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">暂无实时数据</p>
          </div>
        )}
      </div>

      {/* 费用详情 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">费用明细</h3>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-gray-600">总输入 Token</span>
              <span className="font-semibold text-gray-900">
                {(database.totalInputTokens || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-gray-600">总输出 Token</span>
              <span className="font-semibold text-gray-900">
                {(database.totalOutputTokens || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-gray-600">总 Token 数</span>
              <span className="font-semibold text-gray-900">
                {((database.totalInputTokens || 0) + (database.totalOutputTokens || 0)).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-semibold text-gray-900">总费用</span>
              <span className="text-2xl font-bold text-purple-600">
                ${(database.totalCostUSD || 0).toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 刷新按钮 */}
      <div className="mt-6">
        <button
          onClick={loadBilling}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          刷新数据
        </button>
      </div>
    </div>
  );
}
