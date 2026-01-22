-- Add location/organization fields to property_types table

ALTER TABLE property_types
ADD COLUMN department VARCHAR(100),
ADD COLUMN city VARCHAR(100),
ADD COLUMN zone VARCHAR(100);

-- Comments
COMMENT ON COLUMN property_types.department IS 'Department/State where properties are located (e.g., Cesar, La Guajira)';
COMMENT ON COLUMN property_types.city IS 'City where properties are located (e.g., Valledupar, Riohacha)';
COMMENT ON COLUMN property_types.zone IS 'Building/Zone/Location name (e.g., Edificio Villa Olímpica, Edificio Las Delicias)';
