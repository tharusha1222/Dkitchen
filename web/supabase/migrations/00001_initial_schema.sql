-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles Enum
CREATE TYPE user_role AS ENUM ('student', 'salesperson', 'admin');

-- Users extension (Supabase Auth maps to this, or we just use this)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role user_role DEFAULT 'student',
    full_name TEXT,
    phone_number TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Stalls
CREATE TABLE public.stalls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Menu Items
CREATE TABLE public.menu_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    price DECIMAL(10, 2) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Offers/Promos
CREATE TABLE public.offers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_amount DECIMAL(10, 2),
    discount_percentage INTEGER,
    expiry TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Orders
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    stall_id UUID REFERENCES public.stalls(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'pending',
    qr_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Order Items
CREATE TABLE public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id),
    quantity INTEGER NOT NULL,
    price_at_time DECIMAL(10, 2) NOT NULL
);

-- OTPs (since we are using a custom WhatsApp flow for OTP, we need a table to store pending OTPs)
CREATE TABLE public.otps (
    phone_number TEXT PRIMARY KEY,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies (simplified for now)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- Allow public read access to stalls and menu items
CREATE POLICY "Allow public read stalls" ON public.stalls FOR SELECT USING (true);
CREATE POLICY "Allow public read menu_items" ON public.menu_items FOR SELECT USING (true);

-- Otps should only be managed by a service role, but for demo we can allow anon to insert/verify if needed (wait, anon inserting an OTP request is fine)
CREATE POLICY "Allow anon insert OTP" ON public.otps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon read OTP" ON public.otps FOR SELECT USING (true);
CREATE POLICY "Allow anon update OTP" ON public.otps FOR UPDATE USING (true);
CREATE POLICY "Allow anon delete OTP" ON public.otps FOR DELETE USING (true);

-- Orders policies
CREATE POLICY "Users can insert their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
-- Salespersons can read all orders
CREATE POLICY "Salespersons can read all orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'salesperson')
);
CREATE POLICY "Salespersons can update orders" ON public.orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'salesperson')
);

-- Note: In a real app, strict RLS is necessary. For this prototype, we'll keep it simple.
