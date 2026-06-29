# seed_admin.py

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission

app = create_app()

with app.app_context():

    # ===============================
    # CREATE ADMIN ROLE
    # ===============================
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        admin_role = Role(name="admin")
        db.session.add(admin_role)
        db.session.commit()
        print("✅ Role 'admin' created")

    # ===============================
    # CREATE PERMISSIONS
    # ===============================
    permissions = [
        "view_dashboard",
        "view_reports",
        "manage_users",
        "manage_roles",
        "manage_crops"
    ]

    for perm_code in permissions:
        perm = Permission.query.filter_by(code=perm_code).first()
        if not perm:
            perm = Permission(code=perm_code, name=perm_code.replace("_", " ").title())
            db.session.add(perm)
            db.session.commit()
            print(f"✅ Permission '{perm_code}' created")

        if perm not in admin_role.permissions:
            admin_role.permissions.append(perm)
            db.session.commit()
            print(f"🔗 Permission '{perm_code}' assigned to admin role")

    # ===============================
    # CREATE/UPDATE ADMIN USER
    # ===============================
    admin_user = User.query.filter(
        (User.username == "admin") | (User.email == "iks214262@gmail.com")
    ).first()

    if not admin_user:
        admin_user = User(username="admin", email="iks214262@gmail.com", is_verified=True)
        admin_user.set_password("12345678")
        admin_user.roles.append(admin_role)
        db.session.add(admin_user)
        db.session.commit()
        print("🎉 Admin user created successfully")
        print("👉 Email: iks214262@gmail.com")
        print("👉 Password: 12345678")
    else:
        # If user exists, ensure they are admin, active, verified, and update credentials
        admin_user.email = "iks214262@gmail.com"
        admin_user.is_verified = True
        admin_user.is_active = True
        admin_user.set_password("12345678")
        if admin_role not in admin_user.roles:
            admin_user.roles.append(admin_role)
        db.session.commit()
        print("🎉 Admin user updated successfully")
        print("👉 Email: iks214262@gmail.com")
        print("👉 Password: 12345678")
