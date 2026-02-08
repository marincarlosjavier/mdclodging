ALTER TABLE properties
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS location VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(location);

COMMENT ON COLUMN properties.city IS 'City where the property is located';
COMMENT ON COLUMN properties.location IS 'Building or complex name (e.g., Torre A, Edificio Central)';
