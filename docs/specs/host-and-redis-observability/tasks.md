# Host and Redis Observability - Tasks

## Phase 1 - Compose and Scrape Config

- [x] Add Node Exporter service.
- [x] Add Redis Exporter service.
- [x] Keep exporter ports private to the Docker network.
- [x] Add local Prometheus scrape job for Redis Exporter.
- [x] Add production Prometheus scrape jobs for exporters.
- [x] Validate local Compose config.
- [x] Validate production Compose config.

## Phase 2 - Dashboards

- [x] Add `Finsight Host/VPS` dashboard.
- [x] Add `Finsight Redis` dashboard.
- [x] Validate dashboard JSON.

## Phase 3 - Alerts

- [x] Add host memory alert candidate.
- [x] Add host filesystem alert candidate.
- [x] Add Redis memory alert candidate.
- [x] Add Redis eviction alert candidate.
- [x] Add Redis rejected connection alert candidate.
- [x] Validate alert syntax or Compose config.

## Phase 4 - Documentation

- [x] Document local monitoring with exporters.
- [x] Document production monitoring with SSH tunnel/private access.
- [x] Document that MongoDB Atlas remains the database metrics source of truth.

## Out of Scope

- MongoDB Atlas metrics integration.
- cAdvisor/container-level metrics.
- Public Grafana endpoint.
- Moving MongoDB into Docker.
