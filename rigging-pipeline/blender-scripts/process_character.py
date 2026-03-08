"""
Process character model in Blender
- Import GLB
- Enhance rig with weapon sockets
- Export optimized GLB
- Export VRM (optional)
"""

import bpy
import json
import sys
import os

def process_character(args):
    """Main processing function"""

    input_path = args.get('input_path')
    output_path = args.get('output_path')
    add_weapon_sockets = args.get('add_weapon_sockets', True)
    add_ik_targets = args.get('add_ik_targets', True)
    draco_compression = args.get('draco_compression', True)
    export_vrm = args.get('export_vrm', False)
    vrm_output_path = args.get('vrm_output_path')

    print(f"\n[ProcessCharacter] Starting...")
    print(f"  Input: {input_path}")
    print(f"  Output: {output_path}")

    # Clear scene
    print("[1/5] Clearing scene...")
    clear_scene()

    # Import GLB
    print(f"[2/5] Importing model...")
    try:
        bpy.ops.import_scene.gltf(filepath=input_path)
        print("  ✓ Model imported")
    except Exception as e:
        print(f"  ✗ Import failed: {e}")
        return False

    # Find armature
    print("[3/5] Finding armature...")
    armature = find_armature()
    if not armature:
        print("  ✗ No armature found")
        return False
    print(f"  ✓ Found armature: {armature.name}")

    # Enhance rig
    print("[4/5] Enhancing rig...")
    if add_weapon_sockets or add_ik_targets:
        enhance_rig(armature, add_weapon_sockets, add_ik_targets)
        print("  ✓ Rig enhanced")
    else:
        print("  - Skipped")

    # Export GLB
    print("[5/5] Exporting GLB...")
    try:
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Export with optimizations
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            export_draco_mesh_compression_enable=draco_compression,
            export_draco_mesh_compression_level=10,
            export_image_format='WEBP' if draco_compression else 'AUTO',
            export_texture_dir='',
            export_keep_originals=False,
            export_animations=True,
            export_skins=True,
            export_morph=True,
            export_lights=False,
            export_cameras=False
        )

        # Get file size
        size_mb = os.path.getsize(output_path) / 1024 / 1024
        print(f"  ✓ GLB exported: {size_mb:.2f}MB")

    except Exception as e:
        print(f"  ✗ Export failed: {e}")
        return False

    # Export VRM (optional)
    if export_vrm and vrm_output_path:
        print("[5b/5] Exporting VRM...")
        try:
            # Check if VRM addon is available
            if hasattr(bpy.ops, 'export_scene') and hasattr(bpy.ops.export_scene, 'vrm'):
                os.makedirs(os.path.dirname(vrm_output_path), exist_ok=True)

                bpy.ops.export_scene.vrm(
                    filepath=vrm_output_path,
                    export_invisibles=False,
                    export_only_selections=False
                )

                size_mb = os.path.getsize(vrm_output_path) / 1024 / 1024
                print(f"  ✓ VRM exported: {size_mb:.2f}MB")
            else:
                print("  ⚠ VRM addon not installed, skipping VRM export")
        except Exception as e:
            print(f"  ⚠ VRM export failed: {e}")

    print("\n✅ Processing complete!")
    return True


def clear_scene():
    """Clear all objects from scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()


def find_armature():
    """Find armature in scene"""
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            return obj
    return None


def enhance_rig(armature, add_weapon_sockets=True, add_ik_targets=True):
    """Enhance rig with weapon sockets and IK targets"""

    # Set active object
    bpy.context.view_layer.objects.active = armature

    if add_weapon_sockets:
        # Find hand bones
        right_hand = find_bone(armature, ['RightHand', 'mixamorigRightHand', 'Hand.R'])
        left_hand = find_bone(armature, ['LeftHand', 'mixamorigLeftHand', 'Hand.L'])

        if right_hand:
            create_socket(armature, 'weapon_socket_r', right_hand, (0, 0, 0))

        if left_hand:
            create_socket(armature, 'weapon_socket_l', left_hand, (0, 0, 0))

    if add_ik_targets:
        # IK targets for weapon aiming
        right_hand = find_bone(armature, ['RightHand', 'mixamorigRightHand', 'Hand.R'])
        left_hand = find_bone(armature, ['LeftHand', 'mixamorigLeftHand', 'Hand.L'])

        if right_hand:
            bpy.ops.object.mode_set(mode='POSE')
            create_ik_empty('ik_target_hand_r', right_hand.head)
            bpy.ops.object.mode_set(mode='OBJECT')

        if left_hand:
            bpy.ops.object.mode_set(mode='POSE')
            create_ik_empty('ik_target_hand_l', left_hand.head)
            bpy.ops.object.mode_set(mode='OBJECT')


def find_bone(armature, bone_names):
    """Find bone by trying multiple possible names"""
    for name in bone_names:
        if name in armature.data.bones:
            return armature.data.bones[name]
    return None


def create_socket(armature, socket_name, parent_bone, offset):
    """Create weapon socket as empty parented to bone"""

    # Check if already exists
    if socket_name in bpy.data.objects:
        return

    # Create empty
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    socket = bpy.context.active_object
    socket.name = socket_name
    socket.empty_display_size = 0.1

    # Parent to bone
    socket.parent = armature
    socket.parent_type = 'BONE'
    socket.parent_bone = parent_bone.name
    socket.location = offset

    print(f"  ✓ Created socket: {socket_name}")


def create_ik_empty(name, location):
    """Create IK target empty"""

    if name in bpy.data.objects:
        return

    bpy.ops.object.empty_add(type='SPHERE', location=location)
    empty = bpy.context.active_object
    empty.name = name
    empty.empty_display_size = 0.05

    print(f"  ✓ Created IK target: {name}")


# Main execution
if __name__ == '__main__':
    # Parse arguments
    args = {}
    if len(sys.argv) > sys.argv.index('--') + 1:
        args_json = sys.argv[sys.argv.index('--') + 1]
        try:
            args = json.loads(args_json)
        except Exception as e:
            print(f"Error parsing arguments: {e}")
            sys.exit(1)

    # Process character
    success = process_character(args)
    sys.exit(0 if success else 1)
