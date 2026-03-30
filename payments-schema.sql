-- Švarus Darbas CRM - Mokėjimų Schema
-- Sukurta: 2026-03-28

-- Invoices lentelė
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    stripe_payment_intent_id VARCHAR(255),
    invoice_url TEXT,
    pdf_data BYTEA, -- PDF binary data
    notes TEXT
);

-- Payment Intents lentelė (Stripe integracijai)
CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'eur',
    status VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Methods lentelė (saugomi klientų mokėjimo būdai)
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'card', 'bank_account', etc.
    brand VARCHAR(50), -- 'visa', 'mastercard', etc.
    last4 VARCHAR(4),
    exp_month INTEGER,
    exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions lentelė (mokėjų istorija)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'eur',
    status VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('payment', 'refund', 'partial_refund')),
    stripe_charge_id VARCHAR(255),
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order_id ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_client_id ON payment_intents(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id ON payment_intents(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_client_id ON payment_methods(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(is_default);

CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- RLS (Row Level Security)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies for invoices
CREATE POLICY "Clients can view own invoices" ON invoices
    FOR SELECT USING (client_id = (
        SELECT uid FROM profiles 
        WHERE uid = auth.uid()::text 
        AND role = 'client'
        LIMIT 1
    ));

CREATE POLICY "Staff can view all invoices" ON invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE uid = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Staff can insert invoices" ON invoices
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE uid = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

CREATE POLICY "Staff can update invoices" ON invoices
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE uid = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

-- Policies for payment methods
CREATE POLICY "Clients can manage own payment methods" ON payment_methods
    FOR ALL USING (client_id = (
        SELECT uid FROM profiles 
        WHERE uid = auth.uid()::text 
        AND role = 'client'
        LIMIT 1
    ));

CREATE POLICY "Staff can view all payment methods" ON payment_methods
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE uid = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

-- Policies for transactions
CREATE POLICY "Clients can view own transactions" ON transactions
    FOR SELECT USING (client_id = (
        SELECT uid FROM profiles 
        WHERE uid = auth.uid()::text 
        AND role = 'client'
        LIMIT 1
    ));

CREATE POLICY "Staff can view all transactions" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE uid = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_intents_updated_at 
    BEFORE UPDATE ON payment_intents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at 
    BEFORE UPDATE ON payment_methods 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create invoice from order
CREATE OR REPLACE FUNCTION create_invoice_from_order(
    p_order_id VARCHAR(255),
    p_client_id VARCHAR(255),
    p_amount DECIMAL(10,2),
    p_due_days INTEGER DEFAULT 14
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
BEGIN
    INSERT INTO invoices (
        order_id,
        client_id,
        amount,
        due_date
    ) VALUES (
        p_order_id,
        p_client_id,
        p_amount,
        NOW() + (p_due_days || ' days')::INTERVAL
    ) RETURNING id INTO v_invoice_id;
    
    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark invoice as paid
CREATE OR REPLACE FUNCTION mark_invoice_paid(
    p_invoice_id UUID,
    p_stripe_payment_intent_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE invoices 
    SET 
        status = 'paid',
        paid_at = NOW(),
        stripe_payment_intent_id = p_stripe_payment_intent_id
    WHERE id = p_invoice_id;
    
    -- Create transaction record
    INSERT INTO transactions (
        invoice_id,
        client_id,
        amount,
        status,
        type,
        stripe_charge_id,
        processed_at
    ) 
    SELECT 
        p_invoice_id,
        client_id,
        amount,
        'succeeded',
        'payment',
        p_stripe_payment_intent_id,
        NOW()
    FROM invoices 
    WHERE id = p_invoice_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Sample data (testavimui)
INSERT INTO invoices (order_id, client_id, amount, due_date) VALUES
('order-123', 'client-456', 50.00, NOW() + INTERVAL '14 days'),
('order-789', 'client-456', 75.00, NOW() + INTERVAL '14 days')
ON CONFLICT DO NOTHING;

-- Views for easier querying
CREATE OR REPLACE VIEW client_invoices AS
SELECT 
    i.*,
    o.client_name,
    o.address,
    o.date as order_date,
    o.time as order_time
FROM invoices i
LEFT JOIN orders o ON i.order_id = o.id;

CREATE OR REPLACE VIEW payment_summary AS
SELECT 
    client_id,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as total_paid,
    SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END) as total_refunded,
    MAX(created_at) as last_transaction
FROM transactions
GROUP BY client_id;
