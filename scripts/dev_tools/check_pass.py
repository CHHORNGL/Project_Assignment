from werkzeug.security import check_password_hash

hash_admin = "pbkdf2:sha256:600000$FbXAahp2fdPwD2ao$287c9075b408656bdfd0309092d288a260029bc92f4a755242f53b8d7215f4c7"
print("admin/123:", check_password_hash(hash_admin, "123"))
print("admin/12345678:", check_password_hash(hash_admin, "12345678"))

hash_farmer = "pbkdf2:sha256:600000$syXAhg0XmXelaijA$b52870c31bc8a04eaf591994af6d16de98776e641108f7faa755e55d2709f102"
print("test_farmer/password123:", check_password_hash(hash_farmer, "password123"))
print("test_farmer/test_farmer:", check_password_hash(hash_farmer, "test_farmer"))
