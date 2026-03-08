"""
Enhance character rig with weapon sockets and IK targets
Runs inside Blender via MCP
"""

import bpy
import json
import sys

def enhance_rig(armature_name='Armature', add_weapon_sockets=True, add_ik_targets=True):
    """Enhance character rig"""

    print(f"[EnhanceRig] Processing armature: {armature_name}")

    # Find armature
    armature = bpy.data.objects.get(armature_name)
    if not armature:
        print(f"[EnhanceRig] Armature '{armature_name}' not found")
        return False

    if armature.type != 'ARMATURE':
        print(f"[EnhanceRig] Object '{armature_name}' is not an armature")
        return False

    # Switch to pose mode
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')

    # Add weapon sockets
    if add_weapon_sockets:
        print("[EnhanceRig] Adding weapon sockets...")
        add_weapon_socket(armature, 'weapon_socket_r', 'RightHand')
        add_weapon_socket(armature, 'weapon_socket_l', 'LeftHand')

    # Add IK targets
    if add_ik_targets:
        print("[EnhanceRig] Adding IK targets...")
        add_ik_target(armature, 'ik_target_hand_r', 'RightHand')
        add_ik_target(armature, 'ik_target_hand_l', 'LeftHand')

    # Return to object mode
    bpy.ops.object.mode_set(mode='OBJECT')

    print("[EnhanceRig] ✓ Rig enhancement complete")
    return True


def add_weapon_socket(armature, socket_name, parent_bone_name):
    """Add weapon socket as empty object parented to bone"""

    # Try to find bone with various naming conventions
    bone_names_to_try = [
        parent_bone_name,
        f'mixamorig{parent_bone_name}',
        parent_bone_name.lower(),
        parent_bone_name.upper()
    ]

    parent_bone = None
    for name in bone_names_to_try:
        if name in armature.pose.bones:
            parent_bone = armature.pose.bones[name]
            break

    if not parent_bone:
        print(f"  ⚠ Bone '{parent_bone_name}' not found, skipping socket '{socket_name}'")
        return False

    # Check if socket already exists
    if socket_name in bpy.data.objects:
        print(f"  ✓ Socket '{socket_name}' already exists")
        return True

    # Create empty as weapon socket
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    socket = bpy.context.active_object
    socket.name = socket_name
    socket.empty_display_size = 0.1

    # Parent to bone
    socket.parent = armature
    socket.parent_type = 'BONE'
    socket.parent_bone = parent_bone.name

    # Position socket (adjust as needed)
    socket.location = (0, 0, 0)
    socket.rotation_euler = (0, 0, 0)

    print(f"  ✓ Created socket '{socket_name}' on bone '{parent_bone.name}'")
    return True


def add_ik_target(armature, target_name, bone_name):
    """Add IK target for CCDIKSolver"""

    # Try to find bone
    bone_names_to_try = [
        bone_name,
        f'mixamorig{bone_name}',
        bone_name.lower(),
        bone_name.upper()
    ]

    target_bone = None
    for name in bone_names_to_try:
        if name in armature.pose.bones:
            target_bone = armature.pose.bones[name]
            break

    if not target_bone:
        print(f"  ⚠ Bone '{bone_name}' not found, skipping IK target '{target_name}'")
        return False

    # Check if target already exists
    if target_name in bpy.data.objects:
        print(f"  ✓ IK target '{target_name}' already exists")
        return True

    # Create empty as IK target
    bpy.ops.object.empty_add(type='SPHERE', location=target_bone.head)
    target = bpy.context.active_object
    target.name = target_name
    target.empty_display_size = 0.05

    print(f"  ✓ Created IK target '{target_name}' for bone '{target_bone.name}'")
    return True


# Main execution
if __name__ == '__main__':
    # Parse arguments from MCP
    args = {}
    if len(sys.argv) > 1:
        try:
            args = json.loads(sys.argv[-1])
        except:
            pass

    armature_name = args.get('armature_name', 'Armature')
    add_weapon_sockets = args.get('add_weapon_sockets', True)
    add_ik_targets = args.get('add_ik_targets', True)

    enhance_rig(armature_name, add_weapon_sockets, add_ik_targets)
