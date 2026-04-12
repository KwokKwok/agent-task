import { useEffect, useState } from 'react';
import { CheckCircle2, Folder, Loader2, Server, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

async function fetchJson(path, options) {
  const res = await fetch(path, { credentials: 'include', ...options });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── S3 Config Dialog (ElevenLabs warm style) ── */
function S3ConfigDialog({ open, onOpenChange, config, onVerified }) {
  const s3 = config.s3 || {};
  const [draft, setDraft] = useState({});
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft({
        endpoint: s3.endpoint || '',
        region: s3.region || 'us-east-1',
        bucket: s3.bucket || '',
        accessKeyId: s3.accessKeyId || '',
        secretAccessKey: s3.secretAccessKey || '',
        basePath: s3.basePath || '',
      });
      setVerifyResult(null);
    }
  }, [open]);

  function update(field, value) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setVerifyResult(null);
    setVerifying(true);
    try {
      const result = await fetchJson('/api/s3/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3: { ...s3, ...draft, enabled: false },
        }),
      });
      setVerifyResult(result);
      if (result.ok) {
        onOpenChange(false);
        onVerified({ ...s3, ...draft });
      }
    } catch (err) {
      setVerifyResult({ ok: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  }

  const inputCls =
    'h-9 w-full rounded-[12px] border border-transparent bg-[var(--surface-soft)] px-3.5 text-[13px] leading-[1.5] tracking-[0.014em] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[rgb(147_197_253/0.5)] focus:outline-none transition-colors';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[24px] border-none bg-[var(--panel-bg-strong)] p-0 shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.02)_0px_8px_24px]">
        <DialogTitle className="sr-only">S3 配置</DialogTitle>
        <DialogDescription className="sr-only">
          配置 S3 存储连接参数
        </DialogDescription>
        <div className="px-7 pt-7 pb-2">
          <div className="text-[16px] font-medium tracking-[0.016em] text-[var(--text-main)]">
            S3 云端存储
          </div>
          <div className="mt-1.5 text-[13px] leading-[1.5] tracking-[0.014em] text-[var(--text-soft)]">
            填写连接信息后，验证通过即可启用
          </div>
        </div>

        <div className="space-y-4 px-7 py-5">
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium tracking-[0.014em] text-[var(--text-soft)]">
                Endpoint
              </label>
              <Input
                className={inputCls}
                placeholder="https://cos.ap-beijing.myqcloud.com"
                value={draft.endpoint || ''}
                onChange={e => update('endpoint', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium tracking-[0.014em] text-[var(--text-soft)]">
                  Region
                </label>
                <Input
                  className={inputCls}
                  value={draft.region || 'us-east-1'}
                  onChange={e => update('region', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium tracking-[0.014em] text-[var(--text-soft)]">
                  Bucket
                </label>
                <Input
                  className={inputCls}
                  placeholder="my-bucket"
                  value={draft.bucket || ''}
                  onChange={e => update('bucket', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium tracking-[0.014em] text-[var(--text-soft)]">
                Access Key ID
              </label>
              <Input
                className={inputCls}
                placeholder="AKIA..."
                value={draft.accessKeyId || ''}
                onChange={e => update('accessKeyId', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium tracking-[0.014em] text-[var(--text-soft)]">
                Secret Access Key
              </label>
              <Input
                className={inputCls}
                type="password"
                placeholder="••••••••"
                value={draft.secretAccessKey || ''}
                onChange={e => update('secretAccessKey', e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium tracking-[0.014em] text-[var(--text-soft)]">
                Base Path
                <span className="ml-1 font-normal text-[var(--text-muted)]">
                  可选前缀
                </span>
              </label>
              <Input
                className={inputCls}
                placeholder="agent-task/"
                value={draft.basePath || ''}
                onChange={e => update('basePath', e.target.value)}
              />
            </div>
          </div>

          {verifyResult && (
            <div
              className={`flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 text-[13px] leading-[1.5] tracking-[0.014em] ${
                verifyResult.ok
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
              }`}
            >
              {verifyResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              {verifyResult.ok
                ? '连接成功，下一步将自动配置跨域并启用'
                : verifyResult.error || '连接失败'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] px-7 py-4">
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-full px-4 text-[13px] font-medium tracking-[0.014em] text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={verifying}
            className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--text-main)] px-4 text-[13px] font-medium tracking-[0.014em] text-[var(--panel-bg-strong)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {verifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {verifying ? '验证中...' : '验证配置'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function S3EnableConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onForceEnable,
  loading,
  error,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[24px] border-none bg-[var(--panel-bg-strong)] p-0 shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_4px_4px,rgba(0,0,0,0.02)_0px_8px_24px]">
        <DialogTitle className="sr-only">启用 S3 提示</DialogTitle>
        <DialogDescription className="sr-only">
          启用前请确认自动配置对象存储 bucket 跨域读取
        </DialogDescription>
        <div className="px-7 pt-7 pb-2">
          <div className="text-[16px] font-medium tracking-[0.016em] text-[var(--text-main)]">
            启用前确认
          </div>
          <div className="mt-1.5 text-[13px] leading-[1.5] tracking-[0.014em] text-[var(--text-soft)]">
            确认后将通过 S3 API 自动配置 bucket 跨域规则，并创建所需目录占位文件。
          </div>
        </div>
        <div className="px-7 py-5">
          <div className="rounded-[14px] bg-[var(--surface-soft)] px-4 py-3 text-[13px] leading-[1.6] tracking-[0.014em] text-[var(--text-main)]">
            即将写入：
            <div className="mt-2 font-mono text-[12px] text-[var(--text-soft)]">
              Origin: *<br />
              Methods: GET, HEAD
            </div>
          </div>
          {error ? (
            <div className="mt-3 rounded-[12px] bg-red-50 px-3.5 py-2.5 text-[13px] leading-[1.5] tracking-[0.014em] text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] px-7 py-4">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-8 rounded-full px-4 text-[13px] font-medium tracking-[0.014em] text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
          >
            取消
          </button>
          {error ? (
            <button
              onClick={onForceEnable}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-4 text-[13px] font-medium tracking-[0.014em] text-[var(--text-main)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              仍然启用
            </button>
          ) : null}
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--text-main)] px-4 text-[13px] font-medium tracking-[0.014em] text-[var(--panel-bg-strong)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loading ? '启用中...' : '确认并启用'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Card style: ElevenLabs multi-layer shadow ── */
const cardCls =
  'rounded-[20px] bg-[var(--surface-soft)] p-5 shadow-[rgba(0,0,0,0.06)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_1px_2px]';

export function StoragePane({ config, onSave, saving }) {
  const s3 = config.s3 || {};
  const resourceCache = config.resourceCache || { enabled: true };
  const [stats, setStats] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [s3DialogOpen, setS3DialogOpen] = useState(false);
  const [s3ConfirmOpen, setS3ConfirmOpen] = useState(false);
  const [pendingS3Config, setPendingS3Config] = useState(null);
  const [enablingS3, setEnablingS3] = useState(false);
  const [s3EnableError, setS3EnableError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await fetchJson('/api/storage/stats');
        setStats(data);
      } catch {
        // ignore
      }
    }
    void loadStats();
  }, []);

  async function handleScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await fetchJson('/api/storage/scan-resources', {
        method: 'POST',
      });
      setScanResult(result);
      const data = await fetchJson('/api/storage/stats');
      setStats(data);
    } catch (err) {
      setScanResult({ error: err.message });
    } finally {
      setScanning(false);
    }
  }

  async function handleResourceCacheToggle(enabled) {
    const saved = await onSave(
      { resourceCache: { ...resourceCache, enabled } },
      {
        successMessage: enabled ? '资源缓存已启用' : '资源缓存已关闭',
        errorMessage: '资源缓存配置更新失败',
      },
    );
    if (saved && !enabled) {
      setScanResult(null);
    }
  }

  async function handleS3Toggle(enabled) {
    if (!enabled) {
      await onSave(
        { s3: { ...s3, enabled: false } },
        {
          successMessage: 'S3 已禁用',
          errorMessage: 'S3 配置更新失败',
        },
      );
      return;
    }
    setS3EnableError('');
    setS3DialogOpen(true);
  }

  async function handleConfirmEnable() {
    if (!pendingS3Config) return;
    setEnablingS3(true);
    setS3EnableError('');
    try {
      await fetchJson('/api/s3/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3: { ...pendingS3Config, enabled: false },
        }),
      });
      const saved = await onSave(
        { s3: { ...pendingS3Config, enabled: true } },
        {
          successMessage: 'S3 已启用',
          errorMessage: 'S3 启用失败',
        },
      );
      if (saved) {
        setS3ConfirmOpen(false);
        setPendingS3Config(null);
      }
    } catch (err) {
      setS3EnableError(err.message || 'S3 启用失败');
    } finally {
      setEnablingS3(false);
    }
  }

  async function handleForceEnable() {
    const nextS3Config = pendingS3Config || s3;
    const saved = await onSave(
      { s3: { ...nextS3Config, enabled: true } },
      {
        successMessage: 'S3 已启用',
        successDescription: '已跳过自动跨域配置，请自行确认 bucket CORS 是否已生效',
        errorMessage: 'S3 启用失败',
      },
    );
    if (saved) {
      setS3ConfirmOpen(false);
      setPendingS3Config(null);
      setS3EnableError('');
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[15px] font-medium tracking-[0.016em] text-[var(--text-main)]">
          存储
        </div>
        <div className="mt-1.5 text-[13px] leading-[1.6] tracking-[0.014em] text-[var(--text-soft)]">
          管理数据目录、资源缓存和云端备份
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Data Directory ── */}
        <div className={cardCls}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-soft)] text-[var(--text-soft)]">
              <Folder className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium tracking-[0.014em] text-[var(--text-main)]">
                数据目录
              </div>
              <div className="mt-1 text-[13px] leading-[1.5] tracking-[0.014em] text-[var(--text-soft)]">
                任务工作区和配置文件的存储位置
              </div>
              <div className="mt-3 rounded-[12px] bg-[var(--panel-bg-strong)] px-3.5 py-2.5 font-mono text-[12px] leading-[1.5] tracking-normal text-[var(--text-main)] break-all shadow-[rgba(0,0,0,0.075)_0px_0px_0px_0.5px_inset]">
                {config.dataRoot || '-'}
              </div>
              {config.dataRootSource && config.dataRootSource !== 'default' && (
                <div className="mt-2 text-[11px] tracking-[0.014em] text-[var(--text-muted)]">
                  来源: {config.dataRootSource}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Resource Cache ── */}
        <div className={cardCls}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-soft)] text-[var(--text-soft)]">
              <svg
                className="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[14px] font-medium tracking-[0.014em] text-[var(--text-main)]">
                    资源缓存
                  </div>
                  <div className="mt-1 text-[13px] leading-[1.5] tracking-[0.014em] text-[var(--text-soft)]">
                    将 HTML 报告引用的外部资源下载到本地；关闭后保留原始外链，不影响基础渲染
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <button
                    onClick={handleScan}
                    disabled={scanning || resourceCache.enabled === false}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-3.5 text-[13px] font-medium tracking-[0.014em] text-[var(--text-main)] transition-colors hover:opacity-80 disabled:opacity-50"
                  >
                    {scanning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    扫描资源
                  </button>
                  <Switch
                    checked={resourceCache.enabled !== false}
                    onCheckedChange={handleResourceCacheToggle}
                    disabled={saving}
                  />
                </div>
              </div>
              {stats && (
                <div className="mt-3 text-[12px] tracking-[0.014em] text-[var(--text-soft)]">
                  {stats.assetsCount > 0
                    ? `已缓存 ${stats.assetsCount} 个资源 · ${formatSize(stats.assetsSize)}`
                    : '暂无缓存'}
                </div>
              )}
              {resourceCache.enabled === false && (
                <div className="mt-1.5 text-[12px] tracking-[0.014em] text-[var(--text-soft)]">
                  当前关闭，打开报告时将直接使用原始外部资源地址。
                </div>
              )}
              {scanResult && !scanResult.error && (
                <div className="mt-1.5 text-[12px] tracking-[0.014em] text-[var(--text-soft)]">
                  扫描 {scanResult.scanned} 个任务，新增缓存 {scanResult.cached}{' '}
                  个资源
                  {scanResult.disabled ? '（当前已关闭）' : ''}
                  {scanResult.errors > 0 ? `，${scanResult.errors} 个失败` : ''}
                </div>
              )}
              {scanResult?.error && (
                <div className="mt-1.5 text-[12px] tracking-[0.014em] text-red-600">
                  {scanResult.error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── S3 Cloud Backup ── */}
        <div className={cardCls}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-soft)] text-[var(--text-soft)]">
              <Server className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[14px] font-medium tracking-[0.014em] text-[var(--text-main)]">
                    S3 云端备份
                  </div>
                  <div className="mt-1 text-[13px] leading-[1.5] tracking-[0.014em] text-[var(--text-soft)]">
                    将任务资源与缓存资源同步到私有对象存储，通过签名链接减轻源站带宽压力
                  </div>
                </div>
                <Switch
                  checked={s3.enabled || false}
                  onCheckedChange={handleS3Toggle}
                />
              </div>
              {s3.enabled && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[12px] tracking-[0.014em] text-[var(--text-soft)]">
                    {s3.bucket}
                    {s3.endpoint
                      ? ` · ${s3.endpoint.replace(/^https?:\/\//, '')}`
                      : ''}
                  </div>
                  <button
                    onClick={() => setS3DialogOpen(true)}
                    className="flex h-7 shrink-0 items-center rounded-full bg-[var(--surface-soft)] px-3 text-[12px] font-medium tracking-[0.014em] text-[var(--text-main)] transition-colors hover:opacity-80"
                  >
                    配置
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <S3ConfigDialog
        open={s3DialogOpen}
        onOpenChange={setS3DialogOpen}
        config={config}
        onVerified={(nextS3Config) => {
          setPendingS3Config(nextS3Config);
          setS3EnableError('');
          setS3ConfirmOpen(true);
        }}
      />
      <S3EnableConfirmDialog
        open={s3ConfirmOpen}
        onOpenChange={(open) => {
          setS3ConfirmOpen(open);
          if (!open) {
            setS3EnableError('');
          }
        }}
        onConfirm={handleConfirmEnable}
        onForceEnable={handleForceEnable}
        loading={enablingS3 || saving}
        error={s3EnableError}
      />
    </div>
  );
}
