-- ==============================================================================
-- Hope, Inc. ERP — Database Migration 001 Rollback: Core ERP Schema
-- Task ID: S1-DBA-01 / S1-DBA-02 (Issue #6, #7)
-- ==============================================================================
-- Reverses migration 001 by dropping tables in strict reverse-dependency order.
-- ==============================================================================

DROP TABLE IF EXISTS PAYMENT;
DROP TABLE IF EXISTS SALESDETAIL;
DROP TABLE IF EXISTS SALES;
DROP TABLE IF EXISTS JOBHISTORY;
DROP TABLE IF EXISTS EMPLOYEE;
DROP TABLE IF EXISTS JOB;
DROP TABLE IF EXISTS DEPARTMENT;
DROP TABLE IF EXISTS PRICEHIST;
DROP TABLE IF EXISTS PRODUCT;
DROP TABLE IF EXISTS CUSTOMER;
