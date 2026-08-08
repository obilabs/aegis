-- ============================================================================
-- Aegis ITSM - Seed Data
-- ============================================================================
-- Run this after init.sql to populate the database with sample data
-- Usage: Get-Content seed.sql | docker exec -i aegis_postgres psql -U postgres -d aegis
-- ============================================================================

-- ============================================================================
-- TEST USER ACCOUNT
-- ============================================================================
-- Email: admin@acme.com
-- Password: admin123
-- 
-- The password hash below is for "admin123" using bcrypt
-- You can generate new hashes at: https://bcrypt-generator.com/
-- ============================================================================

-- First, create an organization
INSERT INTO organizations (id, name, domain, email, phone, address, city, state, zip, country, website, timezone)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Acme Corporation',
  'acme.com',
  'it@acme.com',
  '+1 (555) 123-4567',
  '123 Tech Boulevard, Suite 500',
  'San Francisco',
  'California',
  '94105',
  'United States',
  'https://acme.com',
  'America/Los_Angeles'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMPANIES
-- ============================================================================

INSERT INTO companies (id, organization_id, name, type, email, phone, address, city, state, zip, country, website)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Acme Corporation', 'internal', 'contact@acme.com', '+1 (555) 123-4567', '123 Tech Blvd', 'San Francisco', 'CA', '94105', 'USA', 'https://acme.com'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'TechVendor Inc', 'vendor', 'sales@techvendor.com', '+1 (555) 987-6543', '456 Vendor Way', 'Austin', 'TX', '78701', 'USA', 'https://techvendor.com'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CloudServices LLC', 'vendor', 'support@cloudservices.com', '+1 (555) 456-7890', '789 Cloud Ave', 'Seattle', 'WA', '98101', 'USA', 'https://cloudservices.com')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LOCATIONS
-- ============================================================================

INSERT INTO locations (id, organization_id, company_id, name, address, city, state, zip, country, phone, is_primary)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'San Francisco HQ', '123 Tech Blvd, Suite 500', 'San Francisco', 'CA', '94105', 'USA', '+1 (555) 123-4567', true),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'New York Office', '456 Broadway, Floor 12', 'New York', 'NY', '10013', 'USA', '+1 (555) 234-5678', false),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Austin Tech Hub', '789 Innovation Dr', 'Austin', 'TX', '78701', 'USA', '+1 (555) 345-6789', false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONTACTS (People)
-- ============================================================================

INSERT INTO contacts (id, organization_id, company_id, location_id, first_name, last_name, title, email, phone, mobile, department_legacy, is_active, has_portal_access)
VALUES
  -- Employees
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sarah', 'Chen', 'Senior Software Engineer', 'sarah.chen@acme.com', '+1 (555) 111-0001', '+1 (555) 211-0001', 'Engineering', true, true),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Michael', 'Rodriguez', 'VP of Engineering', 'michael.rodriguez@acme.com', '+1 (555) 111-0002', '+1 (555) 211-0002', 'Engineering', true, true),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Emily', 'Park', 'Junior Developer', 'emily.park@acme.com', '+1 (555) 111-0003', '+1 (555) 211-0003', 'Engineering', true, true),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'James', 'Wilson', 'Product Manager', 'james.wilson@acme.com', '+1 (555) 111-0004', '+1 (555) 211-0004', 'Product', true, true),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Lisa', 'Thompson', 'HR Director', 'lisa.thompson@acme.com', '+1 (555) 111-0005', '+1 (555) 211-0005', 'Human Resources', true, true),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'David', 'Kim', 'DevOps Engineer', 'david.kim@acme.com', '+1 (555) 111-0006', '+1 (555) 211-0006', 'Engineering', true, true),
  ('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Jennifer', 'Martinez', 'IT Support Specialist', 'jennifer.martinez@acme.com', '+1 (555) 111-0007', '+1 (555) 211-0007', 'IT', true, true),
  ('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Robert', 'Brown', 'CFO', 'robert.brown@acme.com', '+1 (555) 111-0008', '+1 (555) 211-0008', 'Finance', true, true),
  -- Vendors
  ('d0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', NULL, 'Alex', 'Turner', 'Account Manager', 'alex.turner@techvendor.com', '+1 (555) 987-0001', NULL, 'Sales', true, false),
  ('d0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', NULL, 'Maria', 'Garcia', 'Support Engineer', 'maria.garcia@cloudservices.com', '+1 (555) 456-0001', NULL, 'Support', true, false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ASSET TYPES
-- ============================================================================

INSERT INTO asset_types (id, organization_id, name, description, icon)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Laptop', 'Portable computers', 'laptop'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Desktop', 'Desktop computers', 'desktop'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Monitor', 'Display monitors', 'monitor'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Mobile', 'Smartphones and tablets', 'phone'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Server', 'Physical and virtual servers', 'server'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Network', 'Network equipment', 'network'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Printer', 'Printers and scanners', 'printer'),
  ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Accessory', 'Peripherals and accessories', 'accessory')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ASSETS
-- ============================================================================

INSERT INTO assets (id, organization_id, type_id, contact_id, location_id, company_id, name, asset_tag, serial_number, make, model, status, purchase_date, purchase_cost, warranty_expire, notes)
VALUES
  -- Laptops
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'MacBook Pro 16" M3 Max', 'LPT-SF-0042', 'C02XL1234567', 'Apple', 'MacBook Pro 16-inch 2024', 'assigned', '2024-01-15', 3499.00, '2027-01-15', 'Primary development machine'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'MacBook Pro 14" M3 Pro', 'LPT-SF-0043', 'C02XL1234568', 'Apple', 'MacBook Pro 14-inch 2024', 'assigned', '2024-02-01', 2499.00, '2027-02-01', 'Executive laptop'),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Dell Latitude 5540', 'LPT-SF-0044', 'DELL9876543210', 'Dell', 'Latitude 5540', 'assigned', '2024-03-10', 1299.00, '2027-03-10', NULL),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', NULL, '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ThinkPad X1 Carbon Gen 11', 'LPT-SF-0045', 'LNVX1C11234567', 'Lenovo', 'ThinkPad X1 Carbon Gen 11', 'available', '2024-04-01', 1899.00, '2027-04-01', 'Spare laptop'),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'MacBook Air 15" M3', 'LPT-NYC-0015', 'C02XL1234570', 'Apple', 'MacBook Air 15-inch 2024', 'assigned', '2024-05-15', 1499.00, '2027-05-15', NULL),
  -- Monitors
  ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Dell UltraSharp 27" 4K', 'MON-SF-0128', 'DELLMON1234567', 'Dell', 'U2723QE', 'assigned', '2024-01-15', 649.00, '2027-01-15', 'Primary monitor'),
  ('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Dell UltraSharp 27" 4K', 'MON-SF-0129', 'DELLMON1234568', 'Dell', 'U2723QE', 'assigned', '2024-01-15', 649.00, '2027-01-15', 'Secondary monitor'),
  ('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', NULL, '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'LG 34" Ultrawide', 'MON-SF-0130', 'LGMON1234567', 'LG', '34WN80C-B', 'available', '2024-02-01', 449.00, '2027-02-01', 'Conference room'),
  -- Mobile devices
  ('f0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'iPhone 15 Pro', 'PHN-SF-0089', 'APPL15PRO12345', 'Apple', 'iPhone 15 Pro 256GB', 'assigned', '2024-01-20', 1199.00, '2026-01-20', 'Work phone'),
  ('f0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'iPhone 15 Pro Max', 'PHN-SF-0090', 'APPL15PMAX12345', 'Apple', 'iPhone 15 Pro Max 512GB', 'assigned', '2024-02-01', 1399.00, '2026-02-01', 'Executive phone'),
  -- Servers
  ('f0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', NULL, '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Dell PowerEdge R750', 'SRV-DC1-WEB-001', 'DELLSRV1234567', 'Dell', 'PowerEdge R750', 'active', '2023-06-01', 8999.00, '2026-06-01', 'Primary web server'),
  ('f0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', NULL, '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Dell PowerEdge R750', 'SRV-DC1-DB-001', 'DELLSRV1234568', 'Dell', 'PowerEdge R750', 'active', '2023-06-01', 12999.00, '2026-06-01', 'Primary database server'),
  -- Network equipment
  ('f0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006', NULL, '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Cisco Catalyst 9300', 'NET-SF-SW-001', 'CISCO9300123456', 'Cisco', 'Catalyst 9300-48P', 'active', '2023-01-15', 4599.00, '2026-01-15', 'Main floor switch'),
  ('f0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006', NULL, '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Palo Alto PA-5220', 'NET-SF-FW-001', 'PA5220123456', 'Palo Alto', 'PA-5220', 'active', '2023-01-15', 15999.00, '2026-01-15', 'Primary firewall')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TICKET CATEGORIES
-- ============================================================================

INSERT INTO ticket_categories (id, organization_id, name, description)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Hardware Issue', 'Physical hardware problems'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Software Issue', 'Application and software problems'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Network Issue', 'Network and connectivity problems'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Access Request', 'System and application access requests'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Hardware Request', 'New equipment requests'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Password Reset', 'Password and authentication issues'),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Security Incident', 'Security-related issues'),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'General Inquiry', 'General IT questions')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TICKET STATUSES
-- ============================================================================

INSERT INTO ticket_statuses (id, organization_id, name, description, color, is_default, is_closed)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'New', 'Newly created ticket', '#3b82f6', true, false),
  ('90000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'In Progress', 'Being worked on', '#8b5cf6', false, false),
  ('90000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Waiting on Customer', 'Awaiting customer response', '#f59e0b', false, false),
  ('90000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Waiting on Vendor', 'Awaiting vendor response', '#f97316', false, false),
  ('90000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Scheduled', 'Scheduled for future work', '#06b6d4', false, false),
  ('90000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Resolved', 'Issue resolved', '#10b981', false, true),
  ('90000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Closed', 'Ticket closed', '#6b7280', false, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TICKETS
-- ============================================================================

INSERT INTO tickets (id, organization_id, subject, description, contact_id, category_id, status_id, priority, source, asset_id, location_id, created_at, updated_at)
VALUES
  -- Sarah Chen's tickets
  ('80000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'VPN connection drops frequently when working from home', 'When working remotely, my VPN connection drops every 30-45 minutes. I have to reconnect manually each time. This started happening after the latest VPN client update.', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'high', 'portal', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
  ('80000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Request new 4K monitor for development work', 'I would like to request an additional 4K monitor for my workstation. The current dual monitor setup is not sufficient for the complex development work I am doing.', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000003', 'medium', 'portal', NULL, '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'),
  ('80000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Need access to GitHub Enterprise organization', 'I need admin access to the acme-corp GitHub Enterprise organization to manage repositories for the new mobile app project.', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000006', 'medium', 'portal', NULL, '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days'),
  
  -- Emily Park's tickets
  ('80000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Laptop keyboard keys sticking', 'Several keys on my Dell laptop keyboard are sticking, particularly the spacebar and the "e" key. Makes typing very difficult.', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'medium', 'portal', 'f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('80000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Cannot install VS Code extensions', 'Getting permission errors when trying to install extensions in VS Code. Error message: "Unable to install extension. Access denied."', 'd0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'medium', 'portal', 'f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
  
  -- James Wilson's tickets
  ('80000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Outlook calendar not syncing with mobile', 'My Outlook calendar on my iPhone is not syncing properly. Meetings added on desktop dont appear on mobile for several hours.', 'd0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000004', 'low', 'email', 'f0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days'),
  
  -- David Kim's tickets
  ('80000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Production server high CPU alert', 'Received alert that SRV-DC1-WEB-001 CPU usage is consistently above 90%. Need to investigate and resolve.', 'd0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'critical', 'monitoring', 'f0000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours'),
  ('80000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Request AWS console access for new project', 'Need developer-level access to AWS console for the new microservices project. Will need EC2, RDS, and S3 permissions.', 'd0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000005', 'medium', 'portal', NULL, '10000000-0000-0000-0000-000000000003', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days'),
  
  -- Lisa Thompson's tickets
  ('80000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'New employee onboarding - John Smith', 'New hire starting Monday. Need laptop, email account, and access to HR systems.', 'd0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', 'high', 'portal', NULL, '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  
  -- Robert Brown's tickets
  ('80000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Password reset for banking portal', 'Locked out of the corporate banking portal. Need password reset urgently for payroll processing.', 'd0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000006', 'critical', 'phone', NULL, '10000000-0000-0000-0000-000000000001', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours')
ON CONFLICT DO NOTHING;

-- Link tickets to assets
INSERT INTO asset_tickets (asset_id, ticket_id, relationship_type)
VALUES
  ('f0000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'affected'),
  ('f0000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000004', 'affected'),
  ('f0000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000007', 'affected')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TICKET REPLIES
-- ============================================================================

INSERT INTO ticket_replies (id, ticket_id, contact_id, reply_text, is_internal, created_at)
VALUES
  -- TKT-1001 replies
  ('70000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000007', 'Hi Sarah, Ive reviewed your issue. This seems to be related to the recent VPN client update. Can you try the following:

1. Open VPN client settings
2. Go to Advanced > Connection
3. Increase the "Keep-alive interval" to 30 seconds

Let me know if this helps.', false, NOW() - INTERVAL '1 day 12 hours'),
  ('70000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Thanks Jennifer! I tried the settings change but still experiencing drops. It seems to happen more frequently during video calls.', false, NOW() - INTERVAL '1 day 6 hours'),
  ('70000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000007', 'Internal note: Escalating to network team. This might be related to the MTU settings on the new VPN concentrator.', true, NOW() - INTERVAL '1 day'),
  
  -- TKT-1002 replies
  ('70000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000007', 'Hi Sarah, Ive submitted your monitor request to procurement. For a 4K monitor, well need manager approval. Ive sent the approval request to Michael Rodriguez.', false, NOW() - INTERVAL '4 days'),
  ('70000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Thanks! Michael has approved it. Any idea on the timeline?', false, NOW() - INTERVAL '3 days 12 hours'),
  
  -- TKT-1007 replies
  ('70000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000006', 'Investigating now. Initial analysis shows a memory leak in the application pool. Restarting the service temporarily.', false, NOW() - INTERVAL '5 hours'),
  ('70000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000006', 'Service restarted. CPU back to normal levels. Root cause identified as a bug in the latest deployment. Rolling back to previous version.', false, NOW() - INTERVAL '3 hours')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CREDENTIALS
-- ============================================================================

INSERT INTO credentials (id, organization_id, name, description, username, password_encrypted, category)
VALUES
  ('60000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'GitHub Enterprise Admin', 'Organization admin account for GitHub Enterprise', 'admin@acme.com', 'encrypted_placeholder', 'application'),
  ('60000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'AWS Root Account', 'AWS root account - use only for emergencies', 'root@acme.com', 'encrypted_placeholder', 'cloud'),
  ('60000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Production Database', 'PostgreSQL admin for production', 'postgres_admin', 'encrypted_placeholder', 'database'),
  ('60000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Stripe API (Live)', 'Production Stripe API key', 'sk_live_****', 'encrypted_placeholder', 'api'),
  ('60000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Firewall Admin', 'Palo Alto firewall management', 'admin', 'encrypted_placeholder', 'network'),
  ('60000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Slack Workspace Admin', 'Slack workspace administrator', 'admin@acme.com', 'encrypted_placeholder', 'application'),
  ('60000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Google Workspace Admin', 'Google Workspace super admin', 'admin@acme.com', 'encrypted_placeholder', 'application')
ON CONFLICT DO NOTHING;

-- Link credentials to assets
INSERT INTO asset_credentials (asset_id, credential_id)
VALUES
  ('f0000000-0000-0000-0000-000000000011', '60000000-0000-0000-0000-000000000003'),
  ('f0000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000003'),
  ('f0000000-0000-0000-0000-000000000014', '60000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- KB CATEGORIES
-- ============================================================================

INSERT INTO kb_categories (id, organization_id, name, description, slug, icon)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Getting Started', 'New employee onboarding and basics', 'getting-started', 'rocket'),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Network & VPN', 'Network connectivity and VPN guides', 'network-vpn', 'globe'),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Software & Apps', 'Software installation and configuration', 'software-apps', 'cube'),
  ('50000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Hardware', 'Hardware setup and troubleshooting', 'hardware', 'computer'),
  ('50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Security', 'Security policies and best practices', 'security', 'shield'),
  ('50000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'HR & Policies', 'Company policies and HR information', 'hr-policies', 'document')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Seed data loaded successfully!' as status;
SELECT 'Organizations: ' || COUNT(*) FROM organizations;
SELECT 'Companies: ' || COUNT(*) FROM companies;
SELECT 'Contacts: ' || COUNT(*) FROM contacts;
SELECT 'Assets: ' || COUNT(*) FROM assets;
SELECT 'Tickets: ' || COUNT(*) FROM tickets;
SELECT 'Credentials: ' || COUNT(*) FROM credentials;
