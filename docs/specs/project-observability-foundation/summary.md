# Tóm tắt — Project Observability Foundation

## Mục tiêu

Xây một nền tảng quan sát dùng chung cho toàn backend, thay vì để Receipt,
Report, Transaction và từng provider tự tạo metrics/Sentry theo cách riêng.

## Phân vai công cụ

```text
Logs       -> chi tiết từng event
Sentry     -> tìm nguyên nhân exception và terminal failure
Prometheus -> lưu số liệu theo thời gian
Grafana    -> dashboard và cảnh báo
Bull Board -> xem từng BullMQ job
Health     -> kiểm tra service có sống/sẵn sàng hay không
```

## Foundation sẽ cung cấp

- endpoint `/metrics`;
- một Prometheus registry dùng chung;
- HTTP request count, latency và error rate;
- CPU, RAM, event-loop lag và uptime;
- BullMQ queue depth, retry, failure và processing time;
- provider metrics cho Gemini, Cloudinary và Resend;
- Sentry helper dùng cho background workers;
- privacy/cardinality rules;
- Prometheus/Grafana Docker profile cho localhost.

## Domain metrics

Foundation chỉ cung cấp công cụ và metrics chung.

Receipt là domain đầu tiên bổ sung:

```text
receipt cache hit/miss/corrupt
receipt scan succeeded/skipped/failed
```

Report và Transaction sẽ tích hợp sau bằng feature riêng. Cách chia này tránh
một PR thay đổi toàn bộ project cùng lúc.

## Quy tắc dữ liệu

Không đưa các giá trị sau vào metric labels:

- user ID;
- job ID;
- email;
- filename;
- image hash;
- database ID;
- raw URL;
- error message;
- dữ liệu tài chính.

Sentry phải scrub headers, cookies, body, query, breadcrumbs, contexts, extras
và raw job payload.

## Localhost

```powershell
docker compose --profile monitoring up -d
```

Mặc định:

- Prometheus: `http://localhost:9090`;
- Grafana: `http://localhost:3000`;
- scrape mỗi 30 giây;
- lưu metrics 7 ngày.

## VPS

Với VPS 2 shared vCPU / 8 GB RAM:

- Prometheus giới hạn khoảng 512 MB RAM;
- Grafana khoảng 256 MB;
- retention 7 ngày;
- `/metrics` chỉ trong private Docker network;
- có thể tắt/move monitoring ra ngoài nếu VPS bị áp lực.

## Phạm vi implementation

1. Metrics registry và `/metrics`.
2. HTTP/process metrics.
3. Sentry background helper và scrubbing.
4. BullMQ metrics chung.
5. Provider metrics chung.
6. Receipt reference integration.
7. Prometheus/Grafana local.
8. Alerts và verification.

Không triển khai đầy đủ Report/Transaction metrics trong feature này.

## Pending còn lại và lý do

Foundation app-level đã có thể dùng cho backend, queue, provider và Receipt.
Các phần còn pending là host/VPS observability và mở rộng domain sau này.

| Pending | Vì sao chưa chốt |
| --- | --- |
| Node Exporter | Cần cấu hình theo VPS/Linux host thật: mounts, filesystem exclude, network private và collector tối thiểu. |
| Dashboard `Finsight Host/VPS` | Cần metrics từ Node Exporter để hiển thị CPU, RAM, disk, network, uptime cấp máy chủ. |
| Host alerts CPU/RAM/disk | Cần baseline thật để tránh alert quá nhạy hoặc quá trễ. |
| Đo resource usage của monitoring stack | Cần đo trên localhost/VPS với Prometheus, Grafana và sau này Node Exporter chạy thật. |
| Production firewall/reverse proxy restrictions | Phụ thuộc cách deploy production: all-in-one VPS, private Docker network, Nginx, VPN hoặc managed monitoring. |
| Report/Transaction/import domain metrics | Đây là domain migration riêng, không nằm trong scope Receipt reference integration. |

Trạng thái đúng của spec: observability foundation cho app đã implement; host
observability bằng Node Exporter và domain migration còn là phase sau.
