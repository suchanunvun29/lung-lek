import sys, binascii
with open(sys.argv[1], 'r', encoding='utf-8') as src:
    hex_str = src.read().strip()
with open(sys.argv[2], 'wb') as dst:
    dst.write(binascii.unhexlify(hex_str))
print('Written', sys.argv[2])
