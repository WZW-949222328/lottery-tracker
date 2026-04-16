# lottery-tracker

GitHub 主页可用的“彩票理财分析”系统，前后端分离：

- 前端：静态网页（暗色科技风）
- 后端：Python FastAPI
- 存储：服务器本地持久化文件 `backend/data/records.json`

## 功能规则

固定 4 个项目：

- 单关（每日目标盈利 100）
- 二串（每日目标盈利 200）
- 博主（每日目标盈利 200）
- 个人（每日目标盈利 200）

每条每日记录包含每个项目：

- 当日投入
- 当日奖金
- 当日目标盈利
- 明日需要盈利
- 当日总盈利（奖金 - 投入）

计算规则：

1. 当日总盈利 = 当日奖金 - 当日投入
2. 若某项目“当天奖金=0”，则该项目“明日需要盈利”=
   历史未追回金额 + 当天成本 + 当天目标盈利 + 明日目标盈利
3. 其中历史未追回金额按该项目历史累计：
   `sum(当日成本 + 当日目标盈利 - 当日奖金)`，最小为 0
4. 统计当天总盈利、累计总盈利

## 本地运行

### 方式一：Docker（推荐）

```bash
docker compose up -d --build
```

启动后访问：

- `http://localhost/index`
- API 健康检查：`http://localhost/api/health`

### 方式二：仅后端调试

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

前端文件在 `frontend/`，静态部署后请求 `/api/*`。

## 部署到腾讯云服务器 49.233.122.150

在服务器上执行（需先安装 Docker 与 Docker Compose）：

```bash
# 1) 拉代码
git clone <你的仓库地址> lottery-tracker
cd lottery-tracker

# 2) 启动
docker compose up -d --build

# 3) 验证
curl http://127.0.0.1/api/health
```

公网访问：

- `http://49.233.122.150/index`

如果无法访问，请检查：

- 腾讯云安全组放行 TCP 80
- 服务器防火墙放行 80

## 本地打包上传并部署（不走 git）

适用于本地改完代码后，直接打包上传到服务器发布。

### 1) 本地打包项目

在项目根目录执行：

```bash
# Windows PowerShell（推荐）
Compress-Archive -Path .\* -DestinationPath .\lottery-tracker.zip -Force
```

如果你在 macOS / Linux：

```bash
tar --exclude=".git" -czf lottery-tracker.tar.gz .
```

### 2) 上传到服务器

```bash
# 以 zip 为例（Windows 常用）
scp .\lottery-tracker.zip ubuntu@49.233.122.150:/home/ubuntu/

# 若使用 tar.gz（macOS/Linux）
scp ./lottery-tracker.tar.gz ubuntu@49.233.122.150:/home/ubuntu/
```

### 3) 服务器解包并启动

SSH 登录服务器后执行：

```bash
cd /ubuntu
mkdir -p lottery-tracker

# zip 包解压（二选一）
unzip -o lottery-tracker.zip -d lottery-tracker

# tar.gz 解压（二选一）
# tar -xzf lottery-tracker.tar.gz -C lottery-tracker

cd lottery-tracker
docker compose up -d --build
```

### 4) 验证部署

```bash
curl http://127.0.0.1/api/health
docker compose ps
```

公网访问：

- `http://49.233.122.150/index`

### 5) 后续更新发布

每次本地改动后重复“打包 -> 上传 -> 解包覆盖 -> 重启”：

```bash
cd /ubuntu/lottery-tracker
docker compose up -d --build
```

## API

- `GET /api/config`：获取项目配置
- `GET /api/records`：获取全部记录
- `POST /api/records`：按日期新增或覆盖当天记录
- `DELETE /api/records/{record_date}`：删除指定日期记录